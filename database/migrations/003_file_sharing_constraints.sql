-- PRIVATE DRIVE PRO V9
-- Ejecutar una sola vez sobre la base de datos existente.
-- Elimina duplicados conservando el permiso más reciente antes de crear
-- la restricción que permite actualizar permisos con seguridad.
DELETE older
FROM file_shares older
INNER JOIN file_shares newer
  ON newer.file_id = older.file_id
 AND newer.shared_with = older.shared_with
 AND newer.id > older.id;

ALTER TABLE file_shares
  ADD UNIQUE KEY uq_file_share_recipient (file_id, shared_with),
  ADD INDEX idx_file_shares_recipient_expiry (shared_with, expires_at);
