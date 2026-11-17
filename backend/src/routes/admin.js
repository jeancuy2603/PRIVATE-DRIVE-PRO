
import { Router } from 'express';

import {
  dashboard,
  pendingUsers,
  listUsers,
  approveUser,
  resendVerification,
  suspendUser,
  reactivateUser,
  deleteUser,
  listRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  regenerateRoomCode,
  saveSystemSetting,
  deleteSystemSetting,
  listFiles,
  auditLogs,
  securityEvents,
  listNotifications,
  backupHistory,
  systemSettings
} from '../controllers/adminController.js';

import {
  requireAuth,
  requireAdmin
} from '../middleware/auth.js';

const router = Router();

// Todas las rutas administrativas requieren
// autenticación y permisos de administrador.
router.use(requireAuth, requireAdmin);

// Dashboard
router.get('/dashboard', dashboard);

// Usuarios
router.get('/users', listUsers);
router.get('/users/pending', pendingUsers);

router.patch('/users/:id/approve', approveUser);
router.post('/users/:id/resend-verification', resendVerification);

router.patch('/users/:id/suspend', suspendUser);
router.patch('/users/:id/reactivate', reactivateUser);
router.delete('/users/:id', deleteUser);

// Salas privadas
router.get('/rooms', listRooms);
router.post('/rooms', createRoom);
router.patch('/rooms/:id', updateRoom);
router.delete('/rooms/:id', deleteRoom);
router.post('/rooms/:id/regenerate-code', regenerateRoomCode);

// Archivos
router.get('/files', listFiles);

// Auditoría y seguridad
router.get('/audit', auditLogs);
router.get('/security/events', securityEvents);

// Notificaciones
router.get('/notifications', listNotifications);

// Respaldos
router.get('/backups', backupHistory);

// Configuración
router.get('/settings', systemSettings);
router.put('/settings', saveSystemSetting);
router.delete('/settings/:key', deleteSystemSetting);

export default router;
