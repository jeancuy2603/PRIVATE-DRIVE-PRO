
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../config/db.js';
import { sha256 } from '../utils/tokens.js';
import {
  sendVerificationEmail,
  sendRoomAccessEmail
} from '../services/emailService.js';
import { audit } from '../services/audit.js';

// ======================================================
// UTILIDADES
// ======================================================

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateRoomAccessCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function validUserId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const ALLOWED_ROOM_QUOTAS = [
  1073741824,
  5368709120,
  10737418240,
  53687091200,
  107374182400
];

const PRIVATE_STORAGE = path.resolve(
  process.env.STORAGE_ROOT || './storage',
  'private'
);

async function createVerificationCode(connection, userId) {
  const code = generateCode();

  await connection.execute(
    `UPDATE email_verification_codes
     SET used_at = NOW()
     WHERE user_id = ?
       AND used_at IS NULL`,
    [userId]
  );

  await connection.execute(
    `INSERT INTO email_verification_codes
      (user_id, code_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [userId, sha256(code)]
  );

  return code;
}

async function safeAudit(req, action, entity, entityId) {
  try {
    await audit(req, action, entity, entityId);
  } catch (error) {
    console.error('Error registrando auditoría:', error.message);
  }
}

// ======================================================
// DASHBOARD
// ======================================================

export async function dashboard(req, res, next) {
  try {
    const [[users]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(status = 'ACTIVA'), 0) AS active,
        COALESCE(SUM(status IN ('PENDIENTE','EN_REVISION')), 0) AS pending,
        COALESCE(SUM(status = 'SUSPENDIDA'), 0) AS suspended,
        COALESCE(SUM(status = 'BLOQUEADA'), 0) AS blocked,
        COALESCE(SUM(status = 'VERIFICACION_PENDIENTE'), 0)
          AS verification_pending
      FROM users
    `);

    const [[files]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(size_bytes), 0) AS bytes
      FROM files
      WHERE deleted_at IS NULL
    `);

    const [[rooms]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(status = 'ACTIVA'), 0) AS active,
        COALESCE(SUM(status = 'SUSPENDIDA'), 0) AS suspended
      FROM private_rooms
    `);

    const [[requests]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM registration_requests
      WHERE status IN ('PENDIENTE', 'EN_REVISION')
    `);

    const [activity] = await pool.query(`
      SELECT
        id, action, entity, entity_id, user_id,
        ip_address, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 15
    `);

    const [security] = await pool.query(`
      SELECT
        id, event, severity, user_id, created_at
      FROM security_events
      ORDER BY created_at DESC
      LIMIT 10
    `);

    return res.json({
      users,
      files,
      rooms,
      requests: requests.total,
      activity,
      security
    });
  } catch (error) {
    next(error);
  }
}

// ======================================================
// SOLICITUDES PENDIENTES
// ======================================================

export async function pendingUsers(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.username,
        u.email,
        u.status,
        u.created_at
      FROM users u
      WHERE u.status IN ('PENDIENTE', 'EN_REVISION')
      ORDER BY u.created_at ASC
    `);

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

// ======================================================
// LISTAR USUARIOS
// ======================================================

export async function listUsers(req, res, next) {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`(
        u.first_name LIKE ?
        OR u.last_name LIKE ?
        OR u.username LIKE ?
        OR u.email LIKE ?
      )`);

      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const allowedStatuses = [
      'PENDIENTE',
      'EN_REVISION',
      'APROBADA',
      'VERIFICACION_PENDIENTE',
      'VERIFICADA',
      'ACTIVA',
      'SUSPENDIDA',
      'BLOQUEADA',
      'RECHAZADA'
    ];

    if (status && allowedStatuses.includes(status)) {
      conditions.push('u.status = ?');
      params.push(status);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const [rows] = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.username,
         u.email,
         u.status,
         u.created_at,
         r.name AS role,
         r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT 200`,
      params
    );

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

// ======================================================
// APROBAR SOLICITUD
// ======================================================

export async function approveUser(req, res, next) {
  let connection;

  try {
    const userId = validUserId(req.params.id);

    if (!userId) {
      return res.status(400).json({
        message: 'Identificador de usuario inválido.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, first_name, email, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    const user = rows[0];

    if (!user || !['PENDIENTE', 'EN_REVISION'].includes(user.status)) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Solicitud no encontrada o ya revisada.'
      });
    }

    const code = await createVerificationCode(connection, userId);

    await connection.execute(
      `UPDATE users
       SET status = 'VERIFICACION_PENDIENTE'
       WHERE id = ?`,
      [userId]
    );

    await connection.execute(
      `UPDATE registration_requests
       SET status = 'APROBADA',
           reviewed_by = ?
       WHERE user_id = ?`,
      [req.user.sub, userId]
    );

    await connection.commit();

    try {
      await sendVerificationEmail(user.email, user.first_name, code);
    } catch (emailError) {
      console.error('Error enviando verificación:', emailError.message);

      return res.status(502).json({
        message: 'La solicitud fue aprobada, pero el correo no pudo enviarse. Puedes reenviar el código.'
      });
    }

    await safeAudit(req, 'USER_APPROVED', 'user', userId);

    return res.json({
      message: 'Solicitud aprobada y código enviado al correo.'
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    next(error);
  } finally {
    if (connection) connection.release();
  }
}

// ======================================================
// REENVIAR CÓDIGO DE VERIFICACIÓN
// ======================================================

export async function resendVerification(req, res, next) {
  let connection;

  try {
    const userId = validUserId(req.params.id);

    if (!userId) {
      return res.status(400).json({
        message: 'Identificador inválido.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, first_name, email, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    const user = rows[0];

    if (!user || user.status !== 'VERIFICACION_PENDIENTE') {
      await connection.rollback();

      return res.status(400).json({
        message: 'El usuario no tiene verificación pendiente.'
      });
    }

    const code = await createVerificationCode(connection, userId);

    await connection.commit();

    try {
      await sendVerificationEmail(user.email, user.first_name, code);
    } catch (emailError) {
      console.error('Error reenviando código:', emailError.message);

      // Invalidar el código que no pudo enviarse.
      await pool.execute(
        `UPDATE email_verification_codes
         SET used_at = NOW()
         WHERE user_id = ?
           AND used_at IS NULL`,
        [userId]
      );

      return res.status(502).json({
        message: 'No se pudo enviar el correo. Puedes intentar reenviarlo nuevamente.'
      });
    }

    await safeAudit(req, 'VERIFICATION_CODE_RESENT', 'user', userId);

    return res.json({
      message: 'Nuevo código enviado correctamente.'
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    next(error);
  } finally {
    if (connection) connection.release();
  }
}

// ======================================================
// SUSPENDER USUARIO
// ======================================================

export async function suspendUser(req, res, next) {
  let connection;

  try {
    const userId = validUserId(req.params.id);

    if (!userId) {
      return res.status(400).json({
        message: 'Identificador inválido.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT
         u.id,
         u.status,
         r.name AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    const user = rows[0];

    if (!user || user.role === 'SUPERADMIN') {
      await connection.rollback();

      return res.status(404).json({
        message: 'Usuario no encontrado o no modificable.'
      });
    }

    if (user.status === 'SUSPENDIDA') {
      await connection.rollback();

      return res.status(409).json({
        message: 'La cuenta ya se encuentra suspendida.'
      });
    }

    await connection.execute(
      `UPDATE users
       SET status = 'SUSPENDIDA'
       WHERE id = ?`,
      [userId]
    );

    await connection.execute(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE user_id = ?
         AND revoked_at IS NULL`,
      [userId]
    );

    await connection.commit();

    await safeAudit(req, 'USER_SUSPENDED', 'user', userId);

    return res.json({
      message: 'Cuenta suspendida y sesiones revocadas correctamente.'
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    next(error);
  } finally {
    if (connection) connection.release();
  }
}

// ======================================================
// REACTIVAR USUARIO
// ======================================================

export async function reactivateUser(req, res, next) {
  let connection;

  try {
    const userId = validUserId(req.params.id);
    if (!userId) return res.status(400).json({ message: 'Identificador inválido.' });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT u.id, u.status, u.email_verified_at, r.name AS role,
        EXISTS (
          SELECT 1 FROM room_members rm
          INNER JOIN private_rooms pr ON pr.id = rm.room_id
          WHERE rm.user_id = u.id AND rm.access_granted_at IS NOT NULL
            AND pr.owner_id = u.id AND pr.status = 'ACTIVA'
        ) AS has_active_room
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1 FOR UPDATE`,
      [userId]
    );

    const user = rows[0];
    if (!user || user.role === 'SUPERADMIN' || userId === Number(req.user.sub)) {
      await connection.rollback();
      return res.status(404).json({ message: 'Usuario no encontrado o no modificable.' });
    }

    if (!['SUSPENDIDA', 'BLOQUEADA'].includes(user.status)) {
      await connection.rollback();
      return res.status(409).json({ message: 'La cuenta no está suspendida ni bloqueada.' });
    }

    // Reactivar la cuenta no debe depender de que el usuario ya haya activado su sala.
    const nextStatus = user.email_verified_at
      ? (Number(user.has_active_room) === 1 ? 'ACTIVA' : 'VERIFICADA')
      : 'VERIFICACION_PENDIENTE';

    await connection.execute('UPDATE users SET status = ? WHERE id = ?', [nextStatus, userId]);
    await connection.commit();

    await safeAudit(req, 'USER_REACTIVATED', 'user', userId);

    return res.json({
      success: true,
      status: nextStatus,
      message: nextStatus === 'VERIFICACION_PENDIENTE'
        ? 'Cuenta rehabilitada. El usuario debe verificar su correo antes de iniciar sesión.'
        : nextStatus === 'VERIFICADA'
          ? 'Cuenta reactivada. Ya puede iniciar sesión y activar su sala privada.'
          : 'Cuenta reactivada correctamente.'
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    next(error);
  } finally {
    if (connection) connection.release();
  }
}

// ======================================================
// ELIMINAR CUENTA DE USUARIO
// ======================================================

export async function deleteUser(req, res, next) {
  let connection;
  let storageNames = [];

  try {
    const userId = validUserId(req.params.id);
    if (!userId) return res.status(400).json({ message: 'Identificador inválido.' });

    if (userId === Number(req.user.sub)) {
      return res.status(409).json({
        message: 'No puedes eliminar la cuenta con la que has iniciado sesión.'
      });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.execute(
      `SELECT u.id, u.username, r.name AS role
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1 FOR UPDATE`,
      [userId]
    );

    const user = users[0];
    if (!user || user.role === 'SUPERADMIN') {
      await connection.rollback();
      return res.status(404).json({ message: 'Usuario no encontrado o protegido.' });
    }

    const [rooms] = await connection.execute(
      'SELECT id FROM private_rooms WHERE owner_id = ?',
      [userId]
    );
    const roomIds = rooms.map(row => Number(row.id));

    const roomClause = roomIds.length
      ? ` OR room_id IN (${roomIds.map(() => '?').join(',')})`
      : '';
    const roomParams = roomIds;

    const [folderRows] = await connection.execute(
      `SELECT id FROM folders WHERE owner_id = ?${roomClause}`,
      [userId, ...roomParams]
    );
    const folderIds = folderRows.map(row => Number(row.id));

    const [fileRows] = await connection.execute(
      `SELECT id, storage_name FROM files WHERE owner_id = ?${roomClause}`,
      [userId, ...roomParams]
    );
    const fileIds = fileRows.map(row => Number(row.id));
    storageNames = fileRows.map(row => row.storage_name);

    if (fileIds.length) {
      const marks = fileIds.map(() => '?').join(',');
      const [versionRows] = await connection.execute(
        `SELECT storage_name FROM file_versions WHERE file_id IN (${marks})`,
        fileIds
      );
      storageNames.push(...versionRows.map(row => row.storage_name));
    }

    if (fileIds.length) {
      const marks = fileIds.map(() => '?').join(',');
      await connection.execute(`DELETE FROM file_shares WHERE file_id IN (${marks})`, fileIds);
      await connection.execute(`DELETE FROM file_versions WHERE file_id IN (${marks})`, fileIds);
      await connection.execute(`DELETE FROM favorites WHERE file_id IN (${marks})`, fileIds);
      await connection.execute(`DELETE FROM trash WHERE file_id IN (${marks})`, fileIds);
    }

    await connection.execute('DELETE FROM file_shares WHERE shared_with = ?', [userId]);
    await connection.execute('DELETE FROM favorites WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM trash WHERE user_id = ?', [userId]);

    if (folderIds.length) {
      const marks = folderIds.map(() => '?').join(',');
      await connection.execute(
        `UPDATE files SET folder_id = NULL WHERE folder_id IN (${marks})`,
        folderIds
      );
      await connection.execute(
        `UPDATE folders SET parent_id = NULL WHERE parent_id IN (${marks})`,
        folderIds
      );
    }

    if (fileIds.length) {
      const marks = fileIds.map(() => '?').join(',');
      await connection.execute(`DELETE FROM files WHERE id IN (${marks})`, fileIds);
    }

    if (roomIds.length) {
      const marks = roomIds.map(() => '?').join(',');
      await connection.execute(`DELETE FROM room_access_codes WHERE room_id IN (${marks})`, roomIds);
      await connection.execute(
        `DELETE FROM room_members WHERE room_id IN (${marks}) OR user_id = ?`,
        [...roomIds, userId]
      );
      await connection.execute(
        `DELETE FROM storage_quotas WHERE room_id IN (${marks}) OR user_id = ?`,
        [...roomIds, userId]
      );
      await connection.execute(
        `DELETE FROM folders WHERE room_id IN (${marks}) OR owner_id = ?`,
        [...roomIds, userId]
      );
      await connection.execute(`DELETE FROM private_rooms WHERE id IN (${marks})`, roomIds);
    } else {
      await connection.execute('DELETE FROM room_members WHERE user_id = ?', [userId]);
      await connection.execute('DELETE FROM storage_quotas WHERE user_id = ?', [userId]);
      await connection.execute('DELETE FROM folders WHERE owner_id = ?', [userId]);
    }

    await connection.execute('DELETE FROM registration_requests WHERE user_id = ?', [userId]);
    await connection.execute(
      'UPDATE registration_requests SET reviewed_by = NULL WHERE reviewed_by = ?',
      [userId]
    );
    await connection.execute('DELETE FROM email_verification_codes WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM notifications WHERE user_id = ?', [userId]);

    // Conservar el historial sin dejar referencias al usuario eliminado.
    await connection.execute('UPDATE access_logs SET user_id = NULL WHERE user_id = ?', [userId]);
    await connection.execute('UPDATE security_events SET user_id = NULL WHERE user_id = ?', [userId]);
    await connection.execute('UPDATE activity_logs SET user_id = NULL WHERE user_id = ?', [userId]);

    await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
    await connection.commit();

    for (const storageName of storageNames) {
      try {
        await fs.unlink(path.join(PRIVATE_STORAGE, path.basename(storageName)));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('No se pudo eliminar archivo físico:', error.message);
        }
      }
    }

    await safeAudit(req, 'USER_DELETED', 'user', userId);
    return res.json({
      success: true,
      message: 'La cuenta y sus datos privados asociados fueron eliminados.'
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch {}
    }
    next(error);
  } finally {
    if (connection) connection.release();
  }
}

// ======================================================
// LISTAR SALAS PRIVADAS
// ======================================================

export async function listRooms(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        pr.id,
        pr.name,
        pr.description,
        pr.owner_id,
        pr.quota_bytes,
        pr.status,
        pr.created_at,
        CONCAT(u.first_name, ' ', u.last_name) AS owner_name,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(rm.members, 0) AS members,
        COALESCE(f.storage_bytes, 0) AS storage_bytes
      FROM private_rooms pr
      LEFT JOIN users u
        ON u.id = pr.owner_id
      LEFT JOIN (
        SELECT room_id, COUNT(*) AS members
        FROM room_members
        GROUP BY room_id
      ) rm
        ON rm.room_id = pr.id
      LEFT JOIN (
        SELECT
          room_id,
          COALESCE(SUM(size_bytes), 0) AS storage_bytes
        FROM files
        WHERE deleted_at IS NULL
        GROUP BY room_id
      ) f
        ON f.room_id = pr.id
      ORDER BY pr.created_at DESC
    `);

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

// ======================================================
// CREAR SALA PRIVADA
// ======================================================

export async function createRoom(req, res, next) {
  let connection = null;
  let transactionStarted = false;

  try {
    const {
      name,
      description = '',
      owner_id,
      quota_bytes = 1073741824,
      code_validity_hours = 24
    } = req.body || {};

    const roomName = String(name || '').trim();
    const roomDescription = String(description || '').trim();
    const ownerId = Number(owner_id);
    const quota = Number(quota_bytes);
    const validityHours = Number(code_validity_hours);

    if (!roomName || roomName.length > 120) {
      return res.status(400).json({
        message: 'El nombre de la sala es obligatorio y no puede superar los 120 caracteres.'
      });
    }

    if (roomDescription.length > 2000) {
      return res.status(400).json({
        message: 'La descripción no puede superar los 2000 caracteres.'
      });
    }

    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
      return res.status(400).json({
        message: 'Selecciona un propietario válido.'
      });
    }

    if (!ALLOWED_ROOM_QUOTAS.includes(quota)) {
      return res.status(400).json({
        message: 'La capacidad debe ser 1, 5, 10, 50 o 100 GB.'
      });
    }

    if (
      !Number.isInteger(validityHours) ||
      validityHours < 1 ||
      validityHours > 720
    ) {
      return res.status(400).json({
        message: 'La vigencia del código debe estar entre 1 y 720 horas.'
      });
    }

    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Bloquear propietario para evitar operaciones simultáneas.
    const [users] = await connection.execute(
      `SELECT id, first_name, last_name, email, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [ownerId]
    );

    const owner = users[0];

    if (!owner) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'El propietario seleccionado no existe.'
      });
    }

    if (!['ACTIVA', 'VERIFICADA'].includes(owner.status)) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: 'El propietario debe tener su cuenta verificada y habilitada.'
      });
    }

    if (!owner.email) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: 'El propietario no tiene un correo registrado.'
      });
    }

    // Evitar que un usuario tenga más de una sala privada.
    // La consulta se ejecuta después de bloquear la fila del usuario.
    const [existingRooms] = await connection.execute(
      `SELECT id, name, status
       FROM private_rooms
       WHERE owner_id = ?
       LIMIT 1
       FOR UPDATE`,
      [ownerId]
    );

    if (existingRooms.length > 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: 'Este usuario ya tiene una sala privada asignada.',
        existingRoom: {
          id: existingRooms[0].id,
          name: existingRooms[0].name,
          status: existingRooms[0].status
        }
      });
    }

    const code = generateRoomAccessCode();
    const codeHash = sha256(code);

    const [roomResult] = await connection.execute(
      `INSERT INTO private_rooms
       (name, description, owner_id, quota_bytes, status)
       VALUES (?, ?, ?, ?, 'ACTIVA')`,
      [roomName, roomDescription, ownerId, quota]
    );

    const roomId = roomResult.insertId;

    await connection.execute(
      `INSERT INTO room_members
       (room_id, user_id, member_role, access_granted_at)
       VALUES (?, ?, 'OWNER', NULL)`,
      [roomId, ownerId]
    );

    await connection.execute(
      `INSERT INTO room_access_codes
       (room_id, code_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${validityHours} HOUR))`,
      [roomId, codeHash]
    );

    await connection.execute(
      `INSERT INTO storage_quotas
       (room_id, quota_bytes)
       VALUES (?, ?)`,
      [roomId, quota]
    );

    await connection.execute(
      `INSERT INTO notifications
       (user_id, title, message)
       VALUES (?, ?, ?)`,
      [
        ownerId,
        'Sala privada creada',
        `Se creó la sala "${roomName}". Revisa tu correo para obtener las especificaciones y el código de acceso.`
      ]
    );

    await connection.commit();
    transactionStarted = false;

    const ownerName =
      `${owner.first_name || ''} ${owner.last_name || ''}`.trim();

    const expiresAt = new Date(
      Date.now() + validityHours * 60 * 60 * 1000
    );

    let emailSent = false;
    let emailErrorMessage = null;

    try {
      await sendRoomAccessEmail(
        owner.email,
        owner.first_name,
        roomName,
        code,
        {
          description: roomDescription,
          quotaBytes: quota,
          validityHours,
          expiresAt,
          ownerName,
          roomId
        }
      );

      emailSent = true;
    } catch (emailError) {
      emailErrorMessage = emailError.message;

      console.error('ERROR ENVIANDO CÓDIGO DE SALA:', {
        message: emailError.message,
        code: emailError.code,
        responseCode: emailError.responseCode
      });
    }

    await safeAudit(
      req,
      'PRIVATE_ROOM_CREATED',
      'private_room',
      roomId
    );

    return res.status(201).json({
      success: true,
      emailSent,
      message: emailSent
        ? 'Sala creada. Las especificaciones y el código fueron enviados al correo del propietario.'
        : 'La sala fue creada, pero el correo no pudo enviarse. Revisa la configuración SMTP y los registros del servidor.',
      emailError: emailSent ? undefined : emailErrorMessage,
      room: {
        id: roomId,
        name: roomName,
        description: roomDescription,
        owner_id: ownerId,
        owner_name: ownerName,
        owner_email: owner.email,
        quota_bytes: quota,
        code_validity_hours: validityHours,
        code_expires_at: expiresAt,
        status: 'ACTIVA'
      }
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error revirtiendo transacción:', rollbackError.message);
      }
    }

    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// ======================================================
// LISTAR ARCHIVOS
// ======================================================

export async function listFiles(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        f.id,
        f.original_name,
        f.mime_type,
        f.size_bytes,
        f.owner_id,
        f.room_id,
        f.created_at,
        u.username,
        u.email
      FROM files f
      LEFT JOIN users u ON u.id = f.owner_id
      WHERE f.deleted_at IS NULL
      ORDER BY f.created_at DESC
      LIMIT 200
    `);

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

// ======================================================
// AUDITORÍA
// ======================================================

export async function auditLogs(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        id, user_id, action, entity, entity_id,
        ip_address, user_agent, details, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 200
    `);

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

// ======================================================
// EVENTOS DE SEGURIDAD
// ======================================================

export async function securityEvents(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        id, user_id, event, severity, details, created_at
      FROM security_events
      ORDER BY created_at DESC
      LIMIT 200
    `);

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

// ======================================================
// NOTIFICACIONES
// ======================================================

export async function listNotifications(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        n.id, n.user_id, n.title, n.message,
        n.read_at, n.created_at,
        u.username, u.email
      FROM notifications n
      LEFT JOIN users u ON u.id = n.user_id
      ORDER BY n.created_at DESC
      LIMIT 200
    `);

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

// ======================================================
// HISTORIAL DE RESPALDOS
// ======================================================

export async function backupHistory(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT
        id, backup_type, file_name, size_bytes,
        status, checksum, created_at
      FROM backup_history
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}

// ======================================================
// CONFIGURACIÓN DEL SISTEMA
// ======================================================

export async function systemSettings(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT setting_key, setting_value, updated_at
      FROM system_settings
      ORDER BY setting_key ASC
    `);

    return res.json(rows);
  } catch (error) {
    next(error);
  }
}
