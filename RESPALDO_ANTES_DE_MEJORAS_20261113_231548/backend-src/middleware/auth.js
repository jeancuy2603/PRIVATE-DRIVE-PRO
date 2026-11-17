
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

// =====================================================
// AUTENTICACIÓN
// =====================================================

async function authenticate(req, res, next, allowPasswordChange = false) {
  try {
    const header = req.headers.authorization || '';

    const token = header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida.'
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET,
        { issuer: 'private-drive-pro' }
      );
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'La sesión ha expirado o el token no es válido.'
      });
    }

    const passwordChangeRequired =
      decoded.passwordChangeRequired === true;

    if (passwordChangeRequired && !allowPasswordChange) {
      return res.status(403).json({
        success: false,
        requiresPasswordChange: true,
        message: 'Debes cambiar tu contraseña temporal antes de continuar.'
      });
    }

    if (allowPasswordChange && !passwordChangeRequired) {
      return res.status(403).json({
        success: false,
        message: 'Esta operación requiere una sesión de recuperación válida.'
      });
    }

    const [users] = await pool.execute(
      `SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.username,
          u.status,
          r.name AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [decoded.sub]
    );

    if (!users.length) {
      return res.status(401).json({
        success: false,
        message: 'El usuario no existe.'
      });
    }

    const user = users[0];

    if (!['ACTIVA', 'VERIFICADA'].includes(user.status)) {
      return res.status(403).json({
        success: false,
        message: 'La cuenta no está habilitada.'
      });
    }

    req.user = {
      sub: user.id,
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      passwordChangeRequired
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

// =====================================================
// MIDDLEWARES DE AUTENTICACIÓN
// =====================================================

export function requireAuth(req, res, next) {
  return authenticate(req, res, next, false);
}

export function requirePasswordChangeAuth(req, res, next) {
  return authenticate(req, res, next, true);
}

// =====================================================
// AUTORIZACIÓN ADMINISTRATIVA
// =====================================================

export function requireAdmin(req, res, next) {
  if (!['SUPERADMIN', 'ADMINISTRADOR'].includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos administrativos.'
    });
  }

  return next();
}

// =====================================================
// ACCESO A SALA PRIVADA
// =====================================================

export async function requireRoomAccess(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT
          u.status,
          COUNT(DISTINCT pr.id) AS authorized_rooms
       FROM users u
       INNER JOIN room_members rm
          ON rm.user_id = u.id
          AND rm.access_granted_at IS NOT NULL
       INNER JOIN private_rooms pr
          ON pr.id = rm.room_id
          AND pr.status = 'ACTIVA'
          AND pr.owner_id = u.id
       WHERE u.id = ?
         AND u.status = 'ACTIVA'
       GROUP BY u.id, u.status`,
      [req.user.sub]
    );

    if (
      !rows.length ||
      Number(rows[0].authorized_rooms) < 1
    ) {
      return res.status(403).json({
        success: false,
        message: 'Debes activar tu sala privada para acceder a los archivos.',
        code: 'PRIVATE_ROOM_NOT_ACTIVE'
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
