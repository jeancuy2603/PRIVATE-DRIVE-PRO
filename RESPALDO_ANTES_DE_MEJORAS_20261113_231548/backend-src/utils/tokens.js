
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// =====================================================
// TOKEN DE ACCESO
// =====================================================

export const accessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,

      // Identifica las sesiones que deben cambiar
      // obligatoriamente su contraseña.
      passwordChangeRequired:
        user.passwordChangeRequired === true
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: `${process.env.ACCESS_TOKEN_MINUTES || 15}m`,
      issuer: 'private-drive-pro'
    }
  );
};

// =====================================================
// TOKEN DE RENOVACIÓN
// =====================================================

export const refreshToken = () => {
  return crypto.randomBytes(48).toString('hex');
};

// =====================================================
// HASH SHA-256
// =====================================================

export const sha256 = (value) => {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
};
