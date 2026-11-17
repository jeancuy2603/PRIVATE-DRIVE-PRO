
import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { sha256 } from '../utils/tokens.js';
import { sendRoomAccessEmail } from '../services/emailService.js';
import { audit } from '../services/audit.js';

function generateRoomCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function safeCompare(a, b) {
  const first = Buffer.from(a, 'hex');
  const second = Buffer.from(b, 'hex');

  return first.length === second.length &&
    first.length > 0 &&
    crypto.timingSafeEqual(first, second);
}

export async function myRoom(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT
         pr.id,
         pr.name,
         pr.description,
         pr.quota_bytes,
         pr.status,
         pr.created_at,
         rm.access_granted_at
       FROM private_rooms pr
       INNER JOIN room_members rm
         ON rm.room_id = pr.id
        AND rm.user_id = ?
       WHERE pr.owner_id = ?
       LIMIT 1`,
      [req.user.sub, req.user.sub]
    );

    if (!rows.length) {
      return res.status(404).json({
        message: 'Todavía no tienes una sala privada asignada.'
      });
    }

    res.json({
      room: rows[0],
      accessGranted: Boolean(rows[0].access_granted_at)
    });
  } catch (error) {
    next(error);
  }
}

export async function activateRoom(req, res, next) {
  const code = String(req.body?.code || '').trim().toUpperCase();

  if (!/^[A-F0-9]{8}$/.test(code)) {
    return res.status(400).json({
      message: 'Ingresa el código de ocho caracteres recibido por correo.'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [users] = await connection.execute(
      `SELECT id, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [req.user.sub]
    );

    const user = users[0];

    if (!user || !['VERIFICADA', 'ACTIVA'].includes(user.status)) {
      await connection.rollback();
      return res.status(403).json({
        message: 'Tu cuenta todavía no está habilitada.'
      });
    }

    const [rooms] = await connection.execute(
      `SELECT pr.id, pr.name
       FROM private_rooms pr
       INNER JOIN room_members rm
         ON rm.room_id = pr.id
        AND rm.user_id = ?
       WHERE pr.owner_id = ?
         AND pr.status = 'ACTIVA'
       LIMIT 1
       FOR UPDATE`,
      [req.user.sub, req.user.sub]
    );

    const room = rooms[0];

    if (!room) {
      await connection.rollback();
      return res.status(404).json({
        message: 'No tienes una sala privada activa. Contacta con el administrador.'
      });
    }

    const [members] = await connection.execute(
      `SELECT access_granted_at
       FROM room_members
       WHERE room_id = ? AND user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [room.id, req.user.sub]
    );

    if (members[0]?.access_granted_at) {
      await connection.rollback();
      return res.status(409).json({
        message: 'Tu sala privada ya está habilitada.'
      });
    }

    const [codes] = await connection.execute(
      `SELECT id, code_hash
       FROM room_access_codes
       WHERE room_id = ?
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [room.id]
    );

    const storedCode = codes[0];

    if (!storedCode || !safeCompare(sha256(code), storedCode.code_hash)) {
      await connection.rollback();

      await audit(req, 'ROOM_ACCESS_DENIED', 'room', room.id);

      return res.status(400).json({
        message: 'El código es incorrecto o ha vencido.'
      });
    }

    await connection.execute(
      `UPDATE room_access_codes
       SET revoked_at = NOW()
       WHERE id = ?`,
      [storedCode.id]
    );

    await connection.execute(
      `UPDATE room_members
       SET access_granted_at = NOW()
       WHERE room_id = ? AND user_id = ?`,
      [room.id, req.user.sub]
    );

    await connection.execute(
      `UPDATE users
       SET status = 'ACTIVA'
       WHERE id = ?`,
      [req.user.sub]
    );

    await connection.commit();

    await audit(req, 'ROOM_ACCESS_GRANTED', 'room', room.id);

    res.json({
      message: 'Sala privada habilitada correctamente.',
      room: {
        id: room.id,
        name: room.name
      },
      accessGranted: true
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

export async function resendRoomCode(req, res, next) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [users] = await connection.execute(
      `SELECT id, first_name, email, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [req.user.sub]
    );

    const user = users[0];

    if (!user || !['VERIFICADA', 'ACTIVA'].includes(user.status)) {
      await connection.rollback();
      return res.status(403).json({
        message: 'Tu cuenta no está habilitada para solicitar un código.'
      });
    }

    const [rooms] = await connection.execute(
      `SELECT pr.id, pr.name
       FROM private_rooms pr
       INNER JOIN room_members rm
         ON rm.room_id = pr.id
        AND rm.user_id = ?
       WHERE pr.owner_id = ?
         AND pr.status = 'ACTIVA'
         AND rm.access_granted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [req.user.sub, req.user.sub]
    );

    const room = rooms[0];

    if (!room) {
      await connection.rollback();
      return res.status(409).json({
        message: 'No tienes una sala pendiente de habilitación.'
      });
    }

    await connection.execute(
      `UPDATE room_access_codes
       SET revoked_at = NOW()
       WHERE room_id = ? AND revoked_at IS NULL`,
      [room.id]
    );

    const code = generateRoomCode();
    const codeHash = sha256(code);
    const hours = Math.max(
      1,
      Number(process.env.ROOM_ACCESS_CODE_HOURS || 24)
    );

    await connection.execute(
      `INSERT INTO room_access_codes
       (room_id, code_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
      [room.id, codeHash, hours]
    );

    await connection.commit();

    try {
      await sendRoomAccessEmail(
        user.email,
        user.first_name,
        room.name,
        code
      );
    } catch (emailError) {
      console.error('No se pudo enviar el código de sala:', emailError.message);

      return res.status(502).json({
        message: 'El código fue generado, pero no se pudo enviar el correo. Intenta solicitarlo nuevamente.'
      });
    }

    await audit(req, 'ROOM_CODE_RESENT', 'room', room.id);

    res.json({
      message: 'Hemos enviado un nuevo código a tu correo.'
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}
