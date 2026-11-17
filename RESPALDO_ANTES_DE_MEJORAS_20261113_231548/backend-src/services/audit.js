
import { pool } from '../config/db.js';

export async function audit(
  req,
  action,
  entity = null,
  entityId = null,
  details = null
) {
  try {
    const userId = req?.user?.sub ?? null;

    const ipAddress =
      req?.ip ??
      req?.socket?.remoteAddress ??
      null;

    const userAgent =
      typeof req?.get === 'function'
        ? req.get('user-agent')
        : req?.headers?.['user-agent'] ?? null;

    await pool.execute(
      `INSERT INTO activity_logs
       (user_id, action, entity, entity_id, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entity,
        entityId,
        ipAddress,
        userAgent,
        details ? JSON.stringify(details) : null
      ]
    );
  } catch (error) {
    console.error('Error registrando auditoría:', error.message);
  }
}
