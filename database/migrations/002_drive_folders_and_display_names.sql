-- PRIVATE DRIVE PRO - Carpetas y nombres personalizados de archivos
-- Ejecutar una sola vez sobre la base de datos existente.

ALTER TABLE files
  ADD COLUMN display_name VARCHAR(255) NULL AFTER original_name;

UPDATE files
SET display_name = original_name
WHERE display_name IS NULL;

ALTER TABLE files
  MODIFY COLUMN display_name VARCHAR(255) NOT NULL;

CREATE INDEX idx_files_owner_folder_deleted
  ON files(owner_id, folder_id, deleted_at);
