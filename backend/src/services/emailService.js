
import nodemailer from 'nodemailer';

let transporter;
let transporterConfigKey = '';

function getTransporter() {
  const {
    EMAIL_HOST = 'smtp.gmail.com',
    EMAIL_PORT = '465',
    EMAIL_SECURE = 'true',
    EMAIL_USER,
    EMAIL_PASS
  } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error(
      'Configuración incompleta: revisa EMAIL_USER y EMAIL_PASS en el archivo .env.'
    );
  }

  const port = Number(EMAIL_PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('EMAIL_PORT no tiene un valor válido.');
  }

  const configKey = [
    EMAIL_HOST,
    port,
    EMAIL_SECURE,
    EMAIL_USER
  ].join('|');

  // Reconstruir el transporte si cambia la configuración.
  if (!transporter || transporterConfigKey !== configKey) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port,
      secure: EMAIL_SECURE === 'true',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS.replace(/\s/g, '')
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      pool: true,
      maxConnections: 3,
      maxMessages: 50
    });

    transporterConfigKey = configKey;
  }

  return transporter;
}

// ======================================================
// VERIFICAR CONEXIÓN SMTP
// ======================================================

export async function verifyEmailConnection() {
  const mailer = getTransporter();

  try {
    await mailer.verify();

    console.log('Conexión SMTP verificada correctamente.');

    return {
      success: true,
      message: 'La conexión con el servidor de correo funciona.'
    };
  } catch (error) {
    console.error('Error verificando SMTP:', {
      message: error.message,
      code: error.code,
      response: error.response,
      command: error.command
    });

    throw error;
  }
}

// ======================================================
// ESCAPAR HTML
// ======================================================

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
// FORMATO DE ALMACENAMIENTO
// ======================================================

function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return 'No especificado';
  }

  if (value >= 1024 ** 3) {
    return `${(value / (1024 ** 3)).toFixed(2)} GB`;
  }

  if (value >= 1024 ** 2) {
    return `${(value / (1024 ** 2)).toFixed(2)} MB`;
  }

  return `${(value / 1024).toFixed(2)} KB`;
}

// ======================================================
// ENVÍO GENERAL
// ======================================================

export async function sendEmail({ to, subject, html, text }) {
  if (!to || !subject || (!html && !text)) {
    throw new Error(
      'El correo necesita destinatario, asunto y contenido.'
    );
  }

  const mailer = getTransporter();

  const sender = process.env.EMAIL_FROM
    || `PRIVATE DRIVE PRO <${process.env.EMAIL_USER}>`;

  try {
    const info = await mailer.sendMail({
      from: sender,
      to,
      subject,
      text,
      html
    });

    console.log('Correo aceptado por el servidor SMTP:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected
    });

    if (info.rejected?.length) {
      throw new Error(
        `El servidor rechazó el destinatario: ${info.rejected.join(', ')}`
      );
    }

    return info;
  } catch (error) {
    console.error('ERROR REAL AL ENVIAR CORREO:', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      command: error.command,
      rejected: error.rejected
    });

    // Conservar el error original para que el backend
    // pueda identificar la causa real del fallo.
    throw error;
  }
}

// ======================================================
// VERIFICACIÓN DE CUENTA
// ======================================================

export async function sendVerificationEmail(email, firstName, code) {
  const safeName = escapeHtml(firstName);
  const safeCode = escapeHtml(code);

  return sendEmail({
    to: email,
    subject: 'Verifica tu correo - PRIVATE DRIVE PRO',

    text: `
Hola ${firstName}.

Tu solicitud de registro ha sido aprobada.

Tu código de verificación es: ${code}

Este código vence en 10 minutos y solo puede utilizarse una vez.

Si no solicitaste esta operación, contacta con el administrador.
`,

    html: `
      <div style="font-family:Arial,sans-serif;background:#f3f6fb;padding:35px">
        <div style="max-width:520px;margin:auto;background:white;padding:35px;border-radius:16px">

          <h2 style="color:#1768db">PRIVATE DRIVE PRO</h2>

          <h3>Verificación de correo electrónico</h3>

          <p>Hola <strong>${safeName}</strong>,</p>

          <p>
            El administrador ha aprobado tu solicitud.
            Introduce este código para verificar tu correo:
          </p>

          <div style="
            background:#edf4ff;
            padding:22px;
            text-align:center;
            border-radius:12px;
            font-size:32px;
            font-weight:bold;
            letter-spacing:9px;
            color:#1768db
          ">
            ${safeCode}
          </div>

          <p>
            Este código vence en 10 minutos y solo puede
            utilizarse una vez.
          </p>

          <p style="color:#8492a5;font-size:12px">
            Si no solicitaste esta operación,
            contacta con el administrador.
          </p>

        </div>
      </div>
    `
  });
}

// ======================================================
// SALA PRIVADA Y ESPECIFICACIONES
// ======================================================

export async function sendRoomAccessEmail(
  email,
  firstName,
  roomName,
  code,
  details = {}
) {
  const {
    description = '',
    quotaBytes = 1073741824,
    validityHours = 24,
    expiresAt = null,
    ownerName = firstName
  } = details;

  const safeName = escapeHtml(firstName);
  const safeOwner = escapeHtml(ownerName);
  const safeRoom = escapeHtml(roomName);
  const safeDescription = escapeHtml(
    description || 'Sin descripción'
  );
  const safeCode = escapeHtml(code);
  const safeQuota = escapeHtml(formatBytes(quotaBytes));
  const safeValidity = escapeHtml(validityHours);

  let expirationText = 'No especificada';

  if (expiresAt) {
    const date = new Date(expiresAt);

    if (!Number.isNaN(date.getTime())) {
      expirationText = date.toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'long',
        timeStyle: 'short'
      });
    }
  }

  const safeExpiration = escapeHtml(expirationText);

  return sendEmail({
    to: email,
    subject: `Tu sala ${roomName} está preparada - PRIVATE DRIVE PRO`,

    text: `
Hola ${firstName}.

El administrador ha creado tu sala privada.

ESPECIFICACIONES:

Sala: ${roomName}
Propietario: ${ownerName}
Descripción: ${description || 'Sin descripción'}
Capacidad: ${formatBytes(quotaBytes)}
Vigencia del código: ${validityHours} horas
Vencimiento: ${expirationText}

CÓDIGO DE ACCESO: ${code}

Conserva este código en un lugar seguro.
No lo compartas con otras personas.
`,

    html: `
      <div style="
        font-family:Arial,sans-serif;
        background:#f3f6fb;
        padding:35px
      ">
        <div style="
          max-width:560px;
          margin:auto;
          background:white;
          padding:35px;
          border-radius:16px
        ">

          <h2 style="color:#1768db">
            PRIVATE DRIVE PRO
          </h2>

          <h3>Tu sala privada está preparada</h3>

          <p>Hola <strong>${safeName}</strong>,</p>

          <p>
            El administrador ha creado y configurado
            tu sala privada. Estas son las especificaciones:
          </p>

          <div style="
            background:#f5f8fc;
            padding:20px;
            border-radius:12px;
            line-height:1.7
          ">

            <p>
              <strong>Nombre de la sala:</strong><br>
              ${safeRoom}
            </p>

            <p>
              <strong>Propietario:</strong><br>
              ${safeOwner}
            </p>

            <p>
              <strong>Descripción:</strong><br>
              ${safeDescription}
            </p>

            <p>
              <strong>Capacidad de almacenamiento:</strong><br>
              ${safeQuota}
            </p>

            <p>
              <strong>Vigencia del código:</strong><br>
              ${safeValidity} horas
            </p>

            <p>
              <strong>Vencimiento del código:</strong><br>
              ${safeExpiration}
            </p>

          </div>

          <h3 style="margin-top:30px">
            Tu código de acceso
          </h3>

          <div style="
            background:#edf4ff;
            padding:24px;
            text-align:center;
            border-radius:12px;
            font-size:32px;
            font-weight:bold;
            letter-spacing:9px;
            color:#1768db
          ">
            ${safeCode}
          </div>

          <p>
            Introduce este código en PRIVATE DRIVE PRO
            para solicitar acceso a tu sala.
          </p>

          <p style="color:#c0392b">
            Este código vence después del tiempo indicado.
            No lo compartas con otras personas.
          </p>

          <p style="color:#8492a5;font-size:12px">
            Si no reconoces esta operación,
            contacta con el administrador.
          </p>

        </div>
      </div>
    `
  });
}
