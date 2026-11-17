
import argon2 from 'argon2';
import crypto from 'node:crypto';

import { pool } from '../config/db.js';

import {
  accessToken,
  refreshToken,
  sha256
} from '../utils/tokens.js';

import {
  sendVerificationEmail,
  sendEmail
} from '../services/emailService.js';

import { audit } from '../services/audit.js';

// ======================================================
// UTILIDADES
// ======================================================

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateTemporaryPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

async function createVerificationCode(connection, userId) {
  const code = generateCode();

  // Invalidar códigos anteriores que todavía estén pendientes.
  await connection.execute(
    `UPDATE email_verification_codes
     SET used_at = NOW()
     WHERE user_id = ?
       AND used_at IS NULL`,
    [userId]
  );

  // Crear un código nuevo con una duración de 10 minutos.
  await connection.execute(
    `INSERT INTO email_verification_codes
      (user_id, code_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
    [userId, sha256(code)]
  );

  return code;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

// ======================================================
// REGISTRO
// ======================================================

export async function register(req, res, next) {
  let connection;

  try {
    const {
      firstName,
      lastName,
      username,
      email,
      password
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !username ||
      !email ||
      !password ||
      String(password).length < 12
    ) {
      return res.status(400).json({
        message: 'Completa todos los campos. La contraseña debe tener al menos 12 caracteres.'
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = String(username).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: 'El correo electrónico no tiene un formato válido.'
      });
    }

    if (
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 60
    ) {
      return res.status(400).json({
        message: 'El nombre de usuario debe tener entre 3 y 60 caracteres.'
      });
    }

    const hash = await argon2.hash(String(password), {
      type: argon2.argon2id
    });

    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO users
       (
         first_name,
         last_name,
         username,
         email,
         password_hash,
         role_id,
         status
       )
       VALUES (?, ?, ?, ?, ?,
         (SELECT id FROM roles WHERE name = 'USUARIO'),
         'PENDIENTE')`,
      [
        String(firstName).trim(),
        String(lastName).trim(),
        normalizedUsername,
        normalizedEmail,
        hash
      ]
    );

    await connection.execute(
      `INSERT INTO registration_requests
       (user_id, status)
       VALUES (?, 'PENDIENTE')`,
      [result.insertId]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Solicitud recibida. El acceso requiere aprobación administrativa.'
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    if (error.code === 'ER_DUP_ENTRY') {
      const [matches] = await pool.execute(
        `SELECT email, username, status FROM users WHERE email = ? OR username = ? LIMIT 2`,
        [normalizeEmail(req.body?.email), String(req.body?.username || '').trim()]
      );
      const emailTaken = matches.some(row => String(row.email).toLowerCase() === normalizeEmail(req.body?.email));
      const usernameTaken = matches.some(row => String(row.username).toLowerCase() === String(req.body?.username || '').trim().toLowerCase());
      const pending = matches.some(row => ['PENDIENTE','EN_REVISION','APROBADA','VERIFICACION_PENDIENTE'].includes(row.status));
      return res.status(409).json({
        code: emailTaken ? 'EMAIL_ALREADY_REGISTERED' : 'USERNAME_ALREADY_REGISTERED',
        message: emailTaken
          ? (pending ? 'Ya existe una solicitud con ese correo y está pendiente de revisión o activación. No necesitas registrarte otra vez; consulta tu correo o contacta al administrador.' : 'Ese correo ya está registrado. Inicia sesión o utiliza Recuperar contraseña.')
          : 'Ese nombre de usuario ya está ocupado. Elige otro nombre de usuario.'
      });
    }

    next(error);

  } finally {
    if (connection) connection.release();
  }
}

// ======================================================
// REENVIAR CÓDIGO DE VERIFICACIÓN
// ======================================================

export async function resendMyVerificationCode(req, res, next) {
  let connection;

  try {
    const identifier = normalizeIdentifier(req.body.identifier);

    if (!identifier) {
      return res.status(400).json({
        message: 'Ingresa tu correo o nombre de usuario.'
      });
    }

    connection = await pool.getConnection();

    const [users] = await connection.execute(
      `SELECT id, first_name, email, status
       FROM users
       WHERE LOWER(email) = ?
          OR LOWER(username) = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    const user = users[0];

    if (!user || user.status !== 'VERIFICACION_PENDIENTE') {
      return res.json({
        success: true,
        message: 'Si la cuenta tiene una verificación pendiente, recibirás instrucciones en tu correo.'
      });
    }

    // Máximo 5 códigos por hora.
    const [[limits]] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM email_verification_codes
       WHERE user_id = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [user.id]
    );

    if (Number(limits.total) >= 5) {
      return res.status(429).json({
        message: 'Has alcanzado el límite de reenvíos. Inténtalo más tarde.'
      });
    }

    // Esperar 60 segundos entre solicitudes.
    const [[recent]] = await connection.execute(
      `SELECT id
       FROM email_verification_codes
       WHERE user_id = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
       LIMIT 1`,
      [user.id]
    );

    if (recent) {
      return res.status(429).json({
        message: 'Espera 60 segundos antes de solicitar otro código.'
      });
    }

    await connection.beginTransaction();

    const code = await createVerificationCode(connection, user.id);

    await connection.commit();

    try {
      await sendVerificationEmail(
        user.email,
        user.first_name,
        code
      );

    } catch (emailError) {
      console.error(
        'Error enviando verificación:',
        emailError.message
      );

      // El código creado no debe seguir siendo válido
      // si no se pudo enviar el correo.
      await connection.execute(
        `UPDATE email_verification_codes
         SET used_at = NOW()
         WHERE user_id = ?
           AND used_at IS NULL`,
        [user.id]
      );

      return res.status(502).json({
        message: 'No se pudo enviar el código. Inténtalo nuevamente más tarde.'
      });
    }

    return res.json({
      success: true,
      message: 'Si la cuenta tiene una verificación pendiente, recibirás el código en tu correo.'
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
// INICIAR SESIÓN
// ======================================================

export async function login(req, res, next) {
  try {
    const { identifier, password } = req.body;

    const normalizedIdentifier = normalizeIdentifier(identifier);

    if (!normalizedIdentifier || !password) {
      return res.status(400).json({
        message: 'Ingresa tu usuario o correo y tu contraseña.'
      });
    }

    const [rows] = await pool.execute(
      `SELECT
         u.id,
         u.email,
         u.username,
         u.password_hash,
         u.status,
         r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.email) = ?
          OR LOWER(u.username) = ?
       LIMIT 1`,
      [normalizedIdentifier, normalizedIdentifier]
    );

    const user = rows[0];

    if (!user || !['ACTIVA', 'VERIFICADA'].includes(user.status)) {
      return res.status(401).json({
        message: 'Credenciales incorrectas o cuenta no habilitada.'
      });
    }

    // Comprobar primero la contraseña habitual.
    const normalPasswordValid = await argon2.verify(
      user.password_hash,
      String(password)
    );

    if (!normalPasswordValid) {
      // Buscar contraseña temporal de recuperación.
      const [temporaryRows] = await pool.execute(
        `SELECT id, temporary_password_hash
         FROM password_reset_tokens
         WHERE user_id = ?
           AND login_used_at IS NULL
           AND used_at IS NULL
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id]
      );

      const temporary = temporaryRows[0];

      if (!temporary) {
        return res.status(401).json({
          message: 'Credenciales incorrectas.'
        });
      }

      const temporaryValid = await argon2.verify(
        temporary.temporary_password_hash,
        String(password)
      );

      if (!temporaryValid) {
        return res.status(401).json({
          message: 'Credenciales incorrectas.'
        });
      }

      // Consumir la contraseña temporal de forma atómica.
      const [consumed] = await pool.execute(
        `UPDATE password_reset_tokens
         SET login_used_at = NOW()
         WHERE id = ?
           AND login_used_at IS NULL
           AND used_at IS NULL
           AND expires_at > NOW()`,
        [temporary.id]
      );

      if (consumed.affectedRows !== 1) {
        return res.status(401).json({
          message: 'La contraseña temporal ya fue utilizada o ha vencido. Solicita otra recuperación.'
        });
      }

      const temporaryAccessToken = accessToken({
        id: user.id,
        email: user.email,
        role: user.role,
        passwordChangeRequired: true
      });

      return res.json({
        success: true,
        accessToken: temporaryAccessToken,
        requiresPasswordChange: true,
        requiresRoomAccess: false,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          status: user.status
        },
        message: 'Acceso temporal autorizado. Debes cambiar tu contraseña antes de continuar.'
      });
    }

    // Inicio de sesión normal.
    const rt = refreshToken();

    await pool.execute(
      `INSERT INTO user_sessions
       (
         user_id,
         refresh_token_hash,
         expires_at,
         ip_address,
         user_agent
       )
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY), ?, ?)`,
      [
        user.id,
        sha256(rt),
        req.ip,
        req.get('user-agent') || null
      ]
    );

    await audit(req, 'LOGIN', 'user', user.id, {
      status: user.status
    });

    res.cookie('refreshToken', rt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 86400000,
      path: '/api/auth'
    });

    return res.json({
      success: true,
      accessToken: accessToken({
        id: user.id,
        email: user.email,
        role: user.role
      }),
      requiresPasswordChange: false,
      requiresRoomAccess: user.status !== 'ACTIVA',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    next(error);
  }
}

// ======================================================
// VERIFICAR CORREO ELECTRÓNICO
// ======================================================

export async function verifyEmail(req, res, next) {
  let connection;

  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();

    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        message: 'Ingresa un correo válido y un código de seis dígitos.'
      });
    }

    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [users] = await connection.execute(
      `SELECT
         u.id,
         u.email,
         u.username,
         u.status,
         r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?
       LIMIT 1
       FOR UPDATE`,
      [email]
    );

    const user = users[0];

    if (!user || user.status !== 'VERIFICACION_PENDIENTE') {
      await connection.rollback();

      return res.status(400).json({
        message: 'No existe una verificación pendiente para este correo.'
      });
    }

    // Obtener el último código que todavía no se ha utilizado.
    // La expiración se comprueba con el reloj de MySQL.
    const [codes] = await connection.execute(
      `SELECT
         id,
         code_hash,
         expires_at,
         attempts,
         CASE
           WHEN expires_at <= NOW() THEN 1
           ELSE 0
         END AS is_expired
       FROM email_verification_codes
       WHERE user_id = ?
         AND used_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [user.id]
    );

    const verification = codes[0];

    if (!verification || Number(verification.attempts) >= 5) {
      await connection.rollback();

      return res.status(400).json({
        message: 'El código no está disponible. Solicita uno nuevo.'
      });
    }

    // Validar vencimiento utilizando exclusivamente MySQL.
    if (Number(verification.is_expired) === 1) {
      await connection.rollback();

      return res.status(400).json({
        message: 'El código ha vencido. Solicita uno nuevo.'
      });
    }

    // Comparación segura del hash recibido con el almacenado.
    const receivedHash = Buffer.from(sha256(code), 'hex');
    const storedHash = Buffer.from(verification.code_hash, 'hex');

    const matches =
      receivedHash.length === storedHash.length &&
      crypto.timingSafeEqual(receivedHash, storedHash);

    if (!matches) {
      await connection.execute(
        `UPDATE email_verification_codes
         SET attempts = attempts + 1,
             used_at = IF(attempts + 1 >= 5, NOW(), used_at)
         WHERE id = ?`,
        [verification.id]
      );

      await connection.commit();

      return res.status(400).json({
        message: 'Código incorrecto. Verifica e inténtalo nuevamente.'
      });
    }

    // Marcar el código como utilizado.
    await connection.execute(
      `UPDATE email_verification_codes
       SET used_at = NOW()
       WHERE id = ?`,
      [verification.id]
    );

    // Cambiar el estado del usuario.
    await connection.execute(
      `UPDATE users
       SET status = 'VERIFICADA',
           email_verified_at = NOW()
       WHERE id = ?`,
      [user.id]
    );

    // Actualizar la solicitud de registro.
    await connection.execute(
      `UPDATE registration_requests
       SET status = 'VERIFICADA'
       WHERE user_id = ?`,
      [user.id]
    );

    await connection.commit();

    const token = accessToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    await audit(
      {
        user: { sub: user.id },
        ip: req.ip,
        headers: req.headers
      },
      'EMAIL_VERIFIED',
      'user',
      user.id
    );

    return res.json({
      success: true,
      message: 'Correo verificado correctamente. Ahora necesitas el código de tu sala privada.',
      accessToken: token,
      requiresRoomAccess: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: 'VERIFICADA'
      }
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    next(error);

  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// ======================================================
// RECUPERAR CONTRASEÑA
// ======================================================

export async function forgotPassword(req, res, next) {
  let connection;

  try {
    const identifier = normalizeIdentifier(req.body.identifier);

    if (!identifier) {
      return res.status(400).json({
        message: 'Ingresa tu nombre de usuario o correo electrónico.'
      });
    }

    connection = await pool.getConnection();

    const [users] = await connection.execute(
      `SELECT id, first_name, email, status
       FROM users
       WHERE LOWER(email) = ?
          OR LOWER(username) = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    const user = users[0];

    const genericResponse = {
      success: true,
      message: 'Si los datos corresponden a una cuenta habilitada, recibirás instrucciones en tu correo.'
    };

    if (!user || !['ACTIVA', 'VERIFICADA'].includes(user.status)) {
      return res.json(genericResponse);
    }

    // Máximo 3 solicitudes por hora.
    const [[limits]] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM password_reset_tokens
       WHERE user_id = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [user.id]
    );

    if (Number(limits.total) >= 3) {
      return res.json(genericResponse);
    }

    const temporaryPassword = generateTemporaryPassword();

    const temporaryHash = await argon2.hash(
      temporaryPassword,
      { type: argon2.argon2id }
    );

    await connection.beginTransaction();

    // Invalidar contraseñas temporales anteriores.
    await connection.execute(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = ?
         AND used_at IS NULL`,
      [user.id]
    );

    await connection.execute(
      `INSERT INTO password_reset_tokens
       (
         user_id,
         temporary_password_hash,
         expires_at
       )
       VALUES (
         ?,
         ?,
         DATE_ADD(NOW(), INTERVAL 30 MINUTE)
       )`,
      [user.id, temporaryHash]
    );

    await connection.commit();

    try {
      const safeName = escapeHtml(user.first_name);
      const safePassword = escapeHtml(temporaryPassword);

      await sendEmail({
        to: user.email,
        subject: 'Recuperación de contraseña - PRIVATE DRIVE PRO',

        text: `
Hola ${user.first_name}.

Recibimos una solicitud para recuperar tu contraseña.

Tu contraseña temporal es:

${temporaryPassword}

Esta contraseña vence en 30 minutos y solo permite iniciar sesión una vez.

Al ingresar, tendrás que crear una contraseña nueva.

Si no solicitaste esta operación, ignora este correo.
`,

        html: `
          <div style="font-family:Arial,sans-serif;background:#f3f6fb;padding:35px">
            <div style="max-width:520px;margin:auto;background:white;padding:35px;border-radius:16px">

              <h2 style="color:#1768db">PRIVATE DRIVE PRO</h2>

              <h3>Recuperación de contraseña</h3>

              <p>Hola <strong>${safeName}</strong>,</p>

              <p>
                Recibimos una solicitud para recuperar
                el acceso a tu cuenta.
              </p>

              <p>Tu contraseña temporal es:</p>

              <div style="
                background:#edf4ff;
                padding:20px;
                text-align:center;
                border-radius:12px;
                font-size:19px;
                font-weight:bold;
                word-break:break-all;
                color:#1768db
              ">
                ${safePassword}
              </div>

              <p>
                Esta contraseña vence en 30 minutos
                y solo permite iniciar sesión una vez.
              </p>

              <p>
                Al ingresar, tendrás que establecer
                una contraseña nueva antes de continuar.
              </p>

              <p style="color:#8492a5;font-size:12px">
                Si no solicitaste esta operación,
                ignora este correo.
              </p>

            </div>
          </div>
        `
      });

    } catch (emailError) {
      await connection.execute(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE user_id = ?
           AND used_at IS NULL`,
        [user.id]
      );

      console.error(
        'Error enviando recuperación:',
        emailError.message
      );

      return res.status(502).json({
        message: 'No fue posible enviar el correo de recuperación. Inténtalo más tarde.'
      });
    }

    return res.json(genericResponse);

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
// CAMBIAR CONTRASEÑA TEMPORAL
// ======================================================

export async function changeTemporaryPassword(req, res, next) {
  let connection;

  try {
    const userId = Number(req.user.sub);

    const {
      newPassword,
      confirmPassword
    } = req.body;

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        message: 'Sesión inválida.'
      });
    }

    if (
      typeof newPassword !== 'string' ||
      newPassword.length < 12 ||
      newPassword.length > 128
    ) {
      return res.status(400).json({
        message: 'La nueva contraseña debe tener entre 12 y 128 caracteres.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: 'Las contraseñas no coinciden.'
      });
    }

    connection = await pool.getConnection();

    await connection.beginTransaction();

    const [tokens] = await connection.execute(
      `SELECT id
       FROM password_reset_tokens
       WHERE user_id = ?
         AND login_used_at IS NOT NULL
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!tokens.length) {
      await connection.rollback();

      return res.status(401).json({
        message: 'La sesión temporal ha vencido o ya fue utilizada. Solicita otra recuperación.'
      });
    }

    const newHash = await argon2.hash(newPassword, {
      type: argon2.argon2id
    });

    await connection.execute(
      `UPDATE users
       SET password_hash = ?
       WHERE id = ?`,
      [newHash, userId]
    );

    // Invalidar todas las recuperaciones pendientes.
    await connection.execute(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = ?
         AND used_at IS NULL`,
      [userId]
    );

    // Revocar sesiones anteriores.
    await connection.execute(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE user_id = ?
         AND revoked_at IS NULL`,
      [userId]
    );

    await connection.commit();

    await audit(
      req,
      'PASSWORD_CHANGED_AFTER_RECOVERY',
      'user',
      userId
    );

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.'
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
// CERRAR SESIÓN
// ======================================================

export async function logout(req, res, next) {
  try {
    const rt = req.cookies?.refreshToken;

    if (rt) {
      await pool.execute(
        `UPDATE user_sessions
         SET revoked_at = NOW()
         WHERE refresh_token_hash = ?`,
        [sha256(rt)]
      );
    }

    res.clearCookie('refreshToken', {
      path: '/api/auth'
    });

    return res.json({
      message: 'Sesión cerrada.'
    });

  } catch (error) {
    next(error);
  }
}

// ======================================================
// PERFIL DEL USUARIO
// ======================================================

export async function me(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         first_name,
         last_name,
         username,
         email,
         status,
         created_at
       FROM users
       WHERE id = ?`,
      [req.user.sub]
    );

    return res.json(rows[0] || null);

  } catch (error) {
    next(error);
  }
}
