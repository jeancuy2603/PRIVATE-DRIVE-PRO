import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import multer from 'multer';
import { pool } from '../config/db.js';
import { audit } from '../services/audit.js';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT || './storage');
const PRIVATE_STORAGE = path.join(STORAGE_ROOT, 'private');
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 100);
const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024;
const MAX_FILES = 10;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'audio/mpeg',
  'application/zip',
  'application/x-zip-compressed'
]);

const INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
  'video/mp4',
  'audio/mpeg'
]);

await mkdir(PRIVATE_STORAGE, { recursive: true });

function storagePath(storageName) {
  return path.join(PRIVATE_STORAGE, path.basename(storageName));
}

function generateStorageName(originalName) {
  const extension = path.extname(originalName).toLowerCase();
  return `${crypto.randomUUID()}${extension}`;
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function cleanDisplayName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 255 || /[\u0000-\u001f]/.test(name)) return null;
  return name;
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function removeUploadedFiles(files = []) {
  await Promise.all(files.map(async file => {
    try {
      await unlink(file.path);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('No se pudo eliminar archivo temporal:', error.message);
      }
    }
  }));
}

async function getActiveRoom(connection, userId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT pr.id, pr.quota_bytes
     FROM private_rooms pr
     INNER JOIN room_members rm ON rm.room_id = pr.id
     WHERE pr.owner_id = ?
       AND rm.user_id = ?
       AND rm.access_granted_at IS NOT NULL
       AND pr.status = 'ACTIVA'
     LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`,
    [userId, userId]
  );
  return rows[0] || null;
}

async function ensureFolderAccess(connection, folderId, userId, roomId) {
  if (!folderId) return true;
  const [rows] = await connection.execute(
    `SELECT id FROM folders
     WHERE id = ? AND owner_id = ? AND room_id = ?
     LIMIT 1`,
    [folderId, userId, roomId]
  );
  return rows.length > 0;
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PRIVATE_STORAGE),
    filename: (_req, file, cb) => cb(null, generateStorageName(file.originalname))
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const error = new Error(`El tipo de archivo ${file.mimetype} no está permitido.`);
      error.status = 415;
      error.expose = true;
      return cb(error);
    }
    cb(null, true);
  }
});

// GET /api/files?folderId=ID (sin folderId = raíz)
export async function listFiles(req, res, next) {
  try {
    const folderId = req.query.folderId ? validId(req.query.folderId) : null;
    if (req.query.folderId && !folderId) {
      return res.status(400).json({ message: 'La carpeta seleccionada no es válida.' });
    }

    const params = [req.user.sub];
    let folderCondition = 'folder_id IS NULL';
    if (folderId) {
      folderCondition = 'folder_id = ?';
      params.push(folderId);
    }

    const [files] = await pool.execute(
      `SELECT id, original_name, display_name, mime_type, size_bytes,
              sha256_hash, folder_id, is_favorite, created_at, updated_at
       FROM files
       WHERE owner_id = ? AND deleted_at IS NULL AND ${folderCondition}
       ORDER BY created_at DESC`,
      params
    );

    res.json({ files });
  } catch (error) {
    next(error);
  }
}

export async function uploadFiles(req, res, next) {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ message: 'Selecciona al menos un archivo.' });
  }

  const folderId = req.body?.folderId ? validId(req.body.folderId) : null;
  if (req.body?.folderId && !folderId) {
    await removeUploadedFiles(files);
    return res.status(400).json({ message: 'La carpeta de destino no es válida.' });
  }

  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const room = await getActiveRoom(connection, req.user.sub, true);
    if (!room) {
      await connection.rollback();
      transactionStarted = false;
      await removeUploadedFiles(files);
      return res.status(403).json({ message: 'No tienes una sala privada activa.' });
    }

    if (!(await ensureFolderAccess(connection, folderId, req.user.sub, room.id))) {
      await connection.rollback();
      transactionStarted = false;
      await removeUploadedFiles(files);
      return res.status(404).json({ message: 'La carpeta de destino no existe.' });
    }

    const [usageRows] = await connection.execute(
      `SELECT COALESCE(SUM(size_bytes), 0) AS used_bytes
       FROM files WHERE room_id = ? AND deleted_at IS NULL`,
      [room.id]
    );

    const usedBytes = BigInt(usageRows[0].used_bytes || 0);
    const quotaBytes = BigInt(room.quota_bytes);
    const newBytes = files.reduce((total, file) => total + BigInt(file.size), 0n);

    if (usedBytes + newBytes > quotaBytes) {
      await connection.rollback();
      transactionStarted = false;
      await removeUploadedFiles(files);
      return res.status(413).json({
        message: 'No tienes suficiente espacio disponible en tu sala privada.',
        storage: {
          usedBytes: usedBytes.toString(),
          quotaBytes: quotaBytes.toString(),
          requestedBytes: newBytes.toString()
        }
      });
    }

    const insertedFiles = [];
    for (const file of files) {
      const sha256Hash = await hashFile(file.path);
      const [result] = await connection.execute(
        `INSERT INTO files
          (owner_id, room_id, folder_id, original_name, display_name,
           storage_name, mime_type, size_bytes, sha256_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.sub, room.id, folderId, file.originalname,
          file.originalname, path.basename(file.filename), file.mimetype,
          file.size, sha256Hash
        ]
      );

      insertedFiles.push({
        id: result.insertId,
        original_name: file.originalname,
        display_name: file.originalname,
        mime_type: file.mimetype,
        size_bytes: file.size,
        folder_id: folderId,
        sha256_hash: sha256Hash
      });
    }

    await connection.commit();
    transactionStarted = false;

    await audit(req, 'FILES_UPLOADED', 'file', null, {
      count: insertedFiles.length,
      totalBytes: newBytes.toString(),
      roomId: room.id,
      folderId
    });

    return res.status(201).json({
      message: 'Archivos guardados correctamente.',
      files: insertedFiles,
      storage: {
        usedBytes: (usedBytes + newBytes).toString(),
        quotaBytes: quotaBytes.toString(),
        availableBytes: (quotaBytes - usedBytes - newBytes).toString()
      }
    });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    await removeUploadedFiles(files);
    next(error);
  } finally {
    connection.release();
  }
}

export async function downloadFile(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Identificador inválido.' });

    const [rows] = await pool.execute(
      `SELECT id, original_name, display_name, storage_name, mime_type, size_bytes
       FROM files
       WHERE id = ? AND owner_id = ? AND deleted_at IS NULL LIMIT 1`,
      [id, req.user.sub]
    );

    if (!rows.length) return res.status(404).json({ message: 'Archivo no encontrado.' });

    const file = rows[0];
    const filePath = storagePath(file.storage_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'El archivo físico no está disponible.' });
    }

    await audit(req, 'FILE_DOWNLOADED', 'file', file.id);
    return res.download(filePath, file.display_name || file.original_name);
  } catch (error) {
    next(error);
  }
}

// Vista previa segura: solo tipos conocidos y no ejecutables.
export async function previewFile(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Identificador inválido.' });

    const [rows] = await pool.execute(
      `SELECT id, original_name, display_name, storage_name, mime_type
       FROM files
       WHERE id = ? AND owner_id = ? AND deleted_at IS NULL LIMIT 1`,
      [id, req.user.sub]
    );

    if (!rows.length) return res.status(404).json({ message: 'Archivo no encontrado.' });
    const file = rows[0];

    if (!INLINE_MIME_TYPES.has(file.mime_type)) {
      return res.status(415).json({
        message: 'Este formato no tiene vista previa integrada. Puedes descargarlo.'
      });
    }

    const filePath = storagePath(file.storage_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'El archivo físico no está disponible.' });
    }

    await audit(req, 'FILE_PREVIEWED', 'file', file.id);
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}

export async function renameFile(req, res, next) {
  try {
    const id = validId(req.params.id);
    const displayName = cleanDisplayName(req.body?.displayName);
    if (!id) return res.status(400).json({ message: 'Identificador inválido.' });
    if (!displayName) {
      return res.status(400).json({ message: 'Escribe un nombre válido de máximo 255 caracteres.' });
    }

    const [result] = await pool.execute(
      `UPDATE files SET display_name = ?
       WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [displayName, id, req.user.sub]
    );

    if (!result.affectedRows) return res.status(404).json({ message: 'Archivo no encontrado.' });
    await audit(req, 'FILE_RENAMED', 'file', id, { displayName });
    return res.json({ message: 'Nombre del archivo actualizado.', display_name: displayName });
  } catch (error) {
    next(error);
  }
}

export async function trashFile(req, res, next) {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ message: 'Identificador inválido.' });

    const [result] = await pool.execute(
      `UPDATE files SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [id, req.user.sub]
    );

    if (!result.affectedRows) return res.status(404).json({ message: 'Archivo no encontrado.' });
    await audit(req, 'FILE_MOVED_TO_TRASH', 'file', id);
    return res.json({ message: 'Archivo enviado a la papelera.' });
  } catch (error) {
    next(error);
  }
}

export async function restoreFile(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [files] = await connection.execute(
      `SELECT id, room_id, size_bytes FROM files
       WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL
       LIMIT 1 FOR UPDATE`,
      [req.params.id, req.user.sub]
    );

    if (!files.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Archivo eliminado no encontrado.' });
    }

    const file = files[0];
    const [rooms] = await connection.execute(
      `SELECT quota_bytes FROM private_rooms
       WHERE id = ? AND owner_id = ? AND status = 'ACTIVA'
       LIMIT 1 FOR UPDATE`,
      [file.room_id, req.user.sub]
    );

    if (!rooms.length) {
      await connection.rollback();
      return res.status(403).json({ message: 'La sala privada no está activa.' });
    }

    const [usage] = await connection.execute(
      `SELECT COALESCE(SUM(size_bytes), 0) AS used_bytes
       FROM files WHERE room_id = ? AND deleted_at IS NULL`,
      [file.room_id]
    );

    if (BigInt(usage[0].used_bytes || 0) + BigInt(file.size_bytes) > BigInt(rooms[0].quota_bytes)) {
      await connection.rollback();
      return res.status(413).json({ message: 'No hay espacio suficiente para restaurar este archivo.' });
    }

    await connection.execute(
      `UPDATE files SET deleted_at = NULL WHERE id = ? AND owner_id = ?`,
      [file.id, req.user.sub]
    );

    await connection.commit();
    await audit(req, 'FILE_RESTORED', 'file', file.id);
    return res.json({ message: 'Archivo restaurado correctamente.' });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    next(error);
  } finally {
    connection.release();
  }
}

export async function permanentlyDeleteFile(req, res, next) {
  const connection = await pool.getConnection();
  let storageNames = [];
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, storage_name FROM files
       WHERE id = ? AND owner_id = ? AND deleted_at IS NOT NULL
       LIMIT 1 FOR UPDATE`,
      [req.params.id, req.user.sub]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'El archivo no está en la papelera.' });
    }

    const file = rows[0];
    storageNames.push(file.storage_name);
    const [versionRows] = await connection.execute(
      'SELECT storage_name FROM file_versions WHERE file_id = ?',
      [file.id]
    );
    storageNames.push(...versionRows.map(row => row.storage_name));

    await connection.execute('DELETE FROM file_shares WHERE file_id = ?', [file.id]);
    await connection.execute('DELETE FROM file_versions WHERE file_id = ?', [file.id]);
    await connection.execute('DELETE FROM favorites WHERE file_id = ?', [file.id]);
    await connection.execute('DELETE FROM trash WHERE file_id = ?', [file.id]);
    await connection.execute('DELETE FROM files WHERE id = ? AND owner_id = ?', [file.id, req.user.sub]);

    await connection.commit();

    for (const storageName of storageNames) {
      try { await unlink(storagePath(storageName)); }
      catch (error) {
        if (error.code !== 'ENOENT') console.error('No se pudo borrar archivo físico:', error.message);
      }
    }

    await audit(req, 'FILE_PERMANENTLY_DELETED', 'file', file.id);
    return res.json({ message: 'Archivo eliminado definitivamente.' });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    next(error);
  } finally {
    connection.release();
  }
}

export async function listTrash(req, res, next) {
  try {
    const [files] = await pool.execute(
      `SELECT id, original_name, display_name, mime_type, size_bytes,
              folder_id, deleted_at, created_at
       FROM files WHERE owner_id = ? AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [req.user.sub]
    );
    return res.json({ files });
  } catch (error) {
    next(error);
  }
}

export async function toggleFavorite(req, res, next) {
  try {
    const isFavorite = req.body?.isFavorite;
    if (typeof isFavorite !== 'boolean') {
      return res.status(400).json({ message: 'El estado del favorito no es válido.' });
    }

    const [result] = await pool.execute(
      `UPDATE files SET is_favorite = ?
       WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`,
      [isFavorite ? 1 : 0, req.params.id, req.user.sub]
    );

    if (!result.affectedRows) return res.status(404).json({ message: 'Archivo no encontrado.' });
    await audit(req, isFavorite ? 'FILE_FAVORITED' : 'FILE_UNFAVORITED', 'file', req.params.id);
    return res.json({
      message: isFavorite ? 'Archivo agregado a Favoritos.' : 'Archivo retirado de Favoritos.',
      isFavorite
    });
  } catch (error) {
    next(error);
  }
}

export async function listRecentFiles(req, res, next) {
  try {
    const [files] = await pool.execute(
      `SELECT f.id, f.original_name, f.display_name, f.mime_type,
              f.size_bytes, f.folder_id, f.is_favorite, f.created_at,
              MAX(a.created_at) AS last_accessed_at
       FROM activity_logs a
       INNER JOIN files f ON f.id = a.entity_id AND f.owner_id = a.user_id
       WHERE a.user_id = ? AND a.entity = 'file'
         AND a.action IN ('FILE_DOWNLOADED','FILE_PREVIEWED')
         AND f.deleted_at IS NULL
       GROUP BY f.id, f.original_name, f.display_name, f.mime_type,
                f.size_bytes, f.folder_id, f.is_favorite, f.created_at
       ORDER BY last_accessed_at DESC LIMIT 50`,
      [req.user.sub]
    );
    return res.json({ files });
  } catch (error) {
    next(error);
  }
}
