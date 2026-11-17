
import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';

import {
  myRoom,
  activateRoom,
  resendRoomCode
} from '../controllers/roomController.js';

const router = Router();

router.use(requireAuth);

router.get('/me', myRoom);
router.post('/activate', activateRoom);
router.post('/resend-code', resendRoomCode);

export default router;
