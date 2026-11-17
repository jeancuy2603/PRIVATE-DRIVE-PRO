
import { Router } from 'express';

import {
  register,
  login,
  logout,
  me,
  verifyEmail,
  resendMyVerificationCode,
  forgotPassword,
  changeTemporaryPassword
} from '../controllers/authController.js';

import {
  requireAuth,
  requirePasswordChangeAuth
} from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);

router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendMyVerificationCode);

router.post('/forgot-password', forgotPassword);

router.post(
  '/change-temporary-password',
  requirePasswordChangeAuth,
  changeTemporaryPassword
);

router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
