import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import adminRoutes from './routes/admin.js';
import roomRoutes from './routes/rooms.js';

import { notFound, errorHandler } from './middleware/errors.js';

const app = express();

const PORT = Number(process.env.PORT || 4000);

// =====================================================
// CONFIGURACIÓN CORS
// =====================================================

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4201',
  ...(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
]);

app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: {
    policy: 'same-site'
  }
}));

app.use(cors({
  origin(origin, callback) {
    // Permitir solicitudes sin encabezado Origin.
    if (!origin) {
      return callback(null, true);
    }

    let parsedOrigin;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      console.warn('Origen CORS inválido:', origin);
      return callback(new Error('Origen no autorizado por CORS.'));
    }

    // Permitir puertos dinámicos únicamente en localhost.
    const isLocalOrigin =
      parsedOrigin.protocol === 'http:' &&
      [
        'localhost',
        '127.0.0.1',
        '[::1]'
      ].includes(parsedOrigin.hostname);

    if (isLocalOrigin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    console.warn(`Origen CORS rechazado: ${origin}`);

    return callback(new Error('Origen no autorizado por CORS.'));
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ],

  optionsSuccessStatus: 204
}));

// =====================================================
// MIDDLEWARE GENERAL
// =====================================================

app.use(express.json({
  limit: '2mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '2mb'
}));

app.use(cookieParser());

// =====================================================
// LIMITACIÓN DE SOLICITUDES
// =====================================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.'
  }
});

app.use('/api', apiLimiter);

// =====================================================
// ESTADO DEL SERVIDOR
// =====================================================

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    application: 'PRIVATE DRIVE PRO',
    message: 'Servidor funcionando correctamente.',
    status: 'ONLINE',
    timestamp: new Date().toISOString()
  });
});

// =====================================================
// RUTAS DE LA APLICACIÓN
// =====================================================

app.use('/api/auth', authRoutes);

app.use('/api/files', fileRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/rooms', roomRoutes);

// =====================================================
// RUTA NO ENCONTRADA
// =====================================================

app.use(notFound);

// =====================================================
// MANEJO CENTRALIZADO DE ERRORES
// =====================================================

app.use(errorHandler);

// =====================================================
// INICIO DEL SERVIDOR
// =====================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('==============================================');
  console.log('          PRIVATE DRIVE PRO API');
  console.log('==============================================');
  console.log(`Servidor: http://localhost:${PORT}`);
  console.log(`Estado: ONLINE`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log('CORS: habilitado para frontend local');
  console.log('Rutas API: /api');
  console.log('==============================================');
  console.log('');
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`ERROR: El puerto ${PORT} ya está ocupado.`);
    console.error('Detén la instancia anterior del servidor.');
  } else {
    console.error('Error iniciando el servidor:', error);
  }

  process.exitCode = 1;
});

export default app;