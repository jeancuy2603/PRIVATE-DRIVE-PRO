
import multer from 'multer';

export function notFound(req, res) {
  res.status(404).json({
    message: 'Ruta no encontrada.'
  });
}

export function errorHandler(err, req, res, next) {
  console.error('Error de API:', err);

  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'El archivo supera el tamaño permitido.',
      LIMIT_FILE_COUNT: 'Has superado la cantidad máxima de archivos.',
      LIMIT_UNEXPECTED_FILE: 'Campo de archivos inesperado o demasiados archivos.',
      LIMIT_PART_COUNT: 'La solicitud contiene demasiadas partes.',
      LIMIT_FIELD_COUNT: 'La solicitud contiene demasiados campos.'
    };

    return res.status(
      err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    ).json({
      message: messages[err.code] || 'No se pudo procesar la carga.'
    });
  }

  if (err.status === 415 && err.expose) {
    return res.status(415).json({
      message: err.message
    });
  }

  const status = Number(err.status) || 500;

  return res.status(status).json({
    message: err.expose && status < 500
      ? err.message
      : 'Error interno del servidor.'
  });
}
