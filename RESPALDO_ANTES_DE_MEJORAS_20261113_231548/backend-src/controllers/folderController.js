
import { pool } from '../config/db.js';
import { audit } from '../services/audit.js';

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validName(value) {
  const name = String(value || '').trim();

  if (!name || name.length > 255 || /[\u0000-\u001f]/.test(name)) {
    return null;
  }

  return name;
}

async function getUserRoom(userId) {
  const [rows] = await pool.execute(
    `SELECT pr.id
     FROM private_rooms pr
     INNER JOIN room_members rm ON rm.room_id = pr.id
     WHERE pr.owner_id = ?
       AND rm.user_id = ?
       AND rm.access_granted_at IS NOT NULL
       AND pr.status = 'ACTIVA'
     LIMIT 1`,
    [userId, userId]
  );

  return rows[0] || null;
}

async function getOwnedFolder(folderId, userId, roomId) {
  const [rows] = await pool.execute(
    `SELECT id, room_id, parent_id, name
     FROM folders
     WHERE id = ?
       AND owner_id = ?
       AND room_id = ?
     LIMIT 1`,
    [folderId, userId, roomId]
  );

  return rows[0] || null;
}

// =====================================================
// LISTAR CARPETAS
// =====================================================

export async function listFolders(req, res, next) {
  try {
    const userId = req.user.sub;
    const room = await getUserRoom(userId);

    if (!room) {
      return res.status(403).json({
        message: 'No tienes una sala privada activa.'
      });
    }

    let parentId = null;

    if (req.query.parentId !== undefined && req.query.parentId !== '') {
      parentId = validId(req.query.parentId);

      if (!parentId) {
        return res.status(400).json({
          message: 'Carpeta padre inválida.'
        });
      }

      const parent = await getOwnedFolder(parentId, userId, room.id);

      if (!parent) {
        return res.status(404).json({
          message: 'Carpeta padre no encontrada.'
        });
      }
    }

    const [folders] = await pool.execute(
      `SELECT id, name, parent_id, created_at, updated_at
       FROM folders
       WHERE owner_id = ?
         AND room_id = ?
         AND ${parentId ? 'parent_id = ?' : 'parent_id IS NULL'}
       ORDER BY name ASC`,
      parentId
        ? [userId, room.id, parentId]
        : [userId, room.id]
    );

    return res.json({
      success: true,
      folders,
      parentId
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// CREAR CARPETA
// =====================================================

export async function createFolder(req, res, next) {
  try {
    const userId = req.user.sub;
    const name = validName(req.body?.name);

    if (!name) {
      return res.status(400).json({
        message: 'El nombre es obligatorio y debe tener máximo 255 caracteres.'
      });
    }

    const room = await getUserRoom(userId);

    if (!room) {
      return res.status(403).json({
        message: 'No tienes una sala privada activa.'
      });
    }

    let parentId = null;

    if (req.body?.parentId !== undefined && req.body.parentId !== null && req.body.parentId !== '') {
      parentId = validId(req.body.parentId);

      if (!parentId) {
        return res.status(400).json({
          message: 'Carpeta padre inválida.'
        });
      }

      const parent = await getOwnedFolder(parentId, userId, room.id);

      if (!parent) {
        return res.status(404).json({
          message: 'Carpeta padre no encontrada.'
        });
      }
    }

    const [duplicates] = await pool.execute(
      `SELECT id
       FROM folders
       WHERE owner_id = ?
         AND room_id = ?
         AND name = ?
         AND ${parentId ? 'parent_id = ?' : 'parent_id IS NULL'}
       LIMIT 1`,
      parentId
        ? [userId, room.id, name, parentId]
        : [userId, room.id, name]
    );

    if (duplicates.length) {
      return res.status(409).json({
        message: 'Ya existe una carpeta con ese nombre en esta ubicación.'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO folders (owner_id, room_id, parent_id, name)
       VALUES (?, ?, ?, ?)`,
      [userId, room.id, parentId, name]
    );

    await audit(req, 'FOLDER_CREATED', 'folder', result.insertId, {
      name,
      parentId
    });

    return res.status(201).json({
      success: true,
      message: 'Carpeta creada correctamente.',
      folder: {
        id: result.insertId,
        name,
        parent_id: parentId
      }
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// RENOMBRAR CARPETA
// =====================================================

export async function renameFolder(req, res, next) {
  try {
    const userId = req.user.sub;
    const id = validId(req.params.id);
    const name = validName(req.body?.name);

    if (!id) {
      return res.status(400).json({
        message: 'Identificador inválido.'
      });
    }

    if (!name) {
      return res.status(400).json({
        message: 'Escribe un nombre válido.'
      });
    }

    const room = await getUserRoom(userId);

    if (!room) {
      return res.status(403).json({
        message: 'No tienes una sala privada activa.'
      });
    }

    const folder = await getOwnedFolder(id, userId, room.id);

    if (!folder) {
      return res.status(404).json({
        message: 'Carpeta no encontrada.'
      });
    }

    const [duplicates] = await pool.execute(
      `SELECT id
       FROM folders
       WHERE owner_id = ?
         AND room_id = ?
         AND name = ?
         AND id <> ?
         AND ${folder.parent_id ? 'parent_id = ?' : 'parent_id IS NULL'}
       LIMIT 1`,
      folder.parent_id
        ? [userId, room.id, name, id, folder.parent_id]
        : [userId, room.id, name, id]
    );

    if (duplicates.length) {
      return res.status(409).json({
        message: 'Ya existe una carpeta con ese nombre.'
      });
    }

    await pool.execute(
      `UPDATE folders
       SET name = ?
       WHERE id = ?
         AND owner_id = ?
         AND room_id = ?`,
      [name, id, userId, room.id]
    );

    await audit(req, 'FOLDER_RENAMED', 'folder', id, {
      name
    });

    return res.json({
      success: true,
      message: 'Carpeta renombrada correctamente.',
      name
    });
  } catch (error) {
    next(error);
  }
}

// =====================================================
// ELIMINAR CARPETA VACÍA
// =====================================================

export async function deleteFolder(req, res, next) {
  try {
    const userId = req.user.sub;
    const id = validId(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: 'Identificador inválido.'
      });
    }

    const room = await getUserRoom(userId);

    if (!room) {
      return res.status(403).json({
        message: 'No tienes una sala privada activa.'
      });
    }

    const folder = await getOwnedFolder(id, userId, room.id);

    if (!folder) {
      return res.status(404).json({
        message: 'Carpeta no encontrada.'
      });
    }

    const [[children]] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM folders
       WHERE parent_id = ?
         AND owner_id = ?
         AND room_id = ?`,
      [id, userId, room.id]
    );

    const [[files]] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM files
       WHERE folder_id = ?
         AND owner_id = ?
         AND room_id = ?
         AND deleted_at IS NULL`,
      [id, userId, room.id]
    );

    if (Number(children.total) > 0 || Number(files.total) > 0) {
      return res.status(409).json({
        message: 'La carpeta no está vacía. Mueve o elimina primero sus archivos y subcarpetas.'
      });
    }

    await pool.execute(
      `DELETE FROM folders
       WHERE id = ?
         AND owner_id = ?
         AND room_id = ?`,
      [id, userId, room.id]
    );

    await audit(req, 'FOLDER_DELETED', 'folder', id);

    return res.json({
      success: true,
      message: 'Carpeta eliminada correctamente.'
    });
  } catch (error) {
    next(error);
  }
}
