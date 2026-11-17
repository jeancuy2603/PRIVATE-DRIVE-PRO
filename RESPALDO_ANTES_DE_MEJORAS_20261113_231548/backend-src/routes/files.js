
import { Router } from 'express';

import {
  requireAuth,
  requireRoomAccess
} from '../middleware/auth.js';

import {
  upload,
  listFiles,
  uploadFiles,
  downloadFile,
  previewFile,
  renameFile,
  trashFile,
  restoreFile,
  permanentlyDeleteFile,
  listTrash,
  toggleFavorite,
  listRecentFiles
} from '../controllers/fileController.js';

import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder
} from '../controllers/folderController.js';

const router = Router();

// =====================================================
// PROTECCIÓN DE TODAS LAS RUTAS
// =====================================================

router.use(requireAuth);
router.use(requireRoomAccess);

// =====================================================
// CARPETAS
// =====================================================

router.get('/folders', listFolders);
router.post('/folders', createFolder);
router.patch('/folders/:id', renameFolder);
router.delete('/folders/:id', deleteFolder);

// =====================================================
// ARCHIVOS
// =====================================================

// IMPORTANTE: listar archivos.
// Esta ruta faltaba en la configuración anterior.
router.get('/', listFiles);

router.get('/trash', listTrash);
router.get('/recent', listRecentFiles);

router.post(
  '/upload',
  upload.array('files', 10),
  uploadFiles
);

router.patch('/:id/favorite', toggleFavorite);
router.patch('/:id/rename', renameFile);
router.patch('/:id/restore', restoreFile);

router.get('/:id/preview', previewFile);
router.get('/:id/download', downloadFile);

router.delete('/:id/permanent', permanentlyDeleteFile);
router.delete('/:id', trashFile);

export default router;
