CREATE DATABASE IF NOT EXISTS private_drive_pro
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE private_drive_pro;

-- =====================================================
-- ROLES
-- =====================================================

CREATE TABLE roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(255)
) ENGINE=InnoDB;

-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  status ENUM(
    'PENDIENTE',
    'EN_REVISION',
    'APROBADA',
    'VERIFICACION_PENDIENTE',
    'VERIFICADA',
    'ACTIVA',
    'SUSPENDIDA',
    'BLOQUEADA',
    'RECHAZADA'
  ) NOT NULL DEFAULT 'PENDIENTE',
  email_verified_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_users_status(status)
) ENGINE=InnoDB;

-- =====================================================
-- REGISTRATION REQUESTS
-- =====================================================

CREATE TABLE registration_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(30) NOT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- =====================================================
-- USER SESSIONS
-- =====================================================

CREATE TABLE user_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_sessions(user_id, revoked_at)
) ENGINE=InnoDB;

-- =====================================================
-- PRIVATE ROOMS
-- =====================================================

CREATE TABLE private_rooms (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  owner_id BIGINT UNSIGNED NOT NULL,
  quota_bytes BIGINT UNSIGNED NOT NULL DEFAULT 1073741824,
  status ENUM('ACTIVA','SUSPENDIDA','ARCHIVADA') DEFAULT 'ACTIVA',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =====================================================
-- ROOM MEMBERS
-- Una sola definición. Incluye access_granted_at.
-- =====================================================

CREATE TABLE room_members (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  member_role VARCHAR(30) DEFAULT 'MEMBER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  access_granted_at DATETIME NULL,
  UNIQUE KEY uq_room_member(room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES private_rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =====================================================
-- ROOM ACCESS CODES
-- =====================================================

CREATE TABLE room_access_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES private_rooms(id),
  INDEX idx_room_access_codes(room_id, revoked_at)
) ENGINE=InnoDB;

-- =====================================================
-- EMAIL VERIFICATION CODES
-- Los códigos de verificación siguen siendo de 6 dígitos.
-- =====================================================

CREATE TABLE email_verification_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_email_codes_user(user_id, used_at)
) ENGINE=InnoDB;

-- =====================================================
-- FOLDERS
-- =====================================================

CREATE TABLE folders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NULL,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (room_id) REFERENCES private_rooms(id),
  FOREIGN KEY (parent_id) REFERENCES folders(id),
  INDEX idx_folders_owner_parent(owner_id, parent_id)
) ENGINE=InnoDB;

-- =====================================================
-- FILES
-- =====================================================

CREATE TABLE files (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NULL,
  folder_id BIGINT UNSIGNED NULL,
  original_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256_hash CHAR(64) NOT NULL,
  deleted_at DATETIME NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (room_id) REFERENCES private_rooms(id),
  FOREIGN KEY (folder_id) REFERENCES folders(id),
  INDEX idx_files_owner_deleted(owner_id, deleted_at),
  INDEX idx_files_owner_folder_deleted(owner_id, folder_id, deleted_at),
  INDEX idx_files_sha256(sha256_hash)
) ENGINE=InnoDB;

-- =====================================================
-- FILE VERSIONS
-- =====================================================

CREATE TABLE file_versions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT UNSIGNED NOT NULL,
  storage_name VARCHAR(255) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB;

-- =====================================================
-- FILE SHARES
-- =====================================================

CREATE TABLE file_shares (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT UNSIGNED NOT NULL,
  shared_with BIGINT UNSIGNED NOT NULL,
  permission ENUM('VIEW','DOWNLOAD','EDIT') DEFAULT 'VIEW',
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id),
  FOREIGN KEY (shared_with) REFERENCES users(id),
  UNIQUE KEY uq_file_share_recipient (file_id, shared_with),
  INDEX idx_file_shares_recipient_expiry (shared_with, expires_at)
) ENGINE=InnoDB;

-- =====================================================
-- FAVORITES
-- =====================================================

CREATE TABLE favorites (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  file_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_favorite(user_id, file_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB;

-- =====================================================
-- TRASH
-- =====================================================

CREATE TABLE trash (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  file_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =====================================================
-- ACCESS LOGS
-- =====================================================

CREATE TABLE access_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  event VARCHAR(80) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =====================================================
-- SECURITY EVENTS
-- =====================================================

CREATE TABLE security_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  event VARCHAR(100) NOT NULL,
  severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'LOW',
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================

CREATE TABLE activity_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80),
  entity_id BIGINT UNSIGNED,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_activity_created(created_at),
  INDEX idx_activity_user_created(user_id, created_at)
) ENGINE=InnoDB;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =====================================================
-- STORAGE QUOTAS
-- =====================================================

CREATE TABLE storage_quotas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  room_id BIGINT UNSIGNED NULL,
  quota_bytes BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_storage_user(user_id),
  UNIQUE KEY uq_storage_room(room_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (room_id) REFERENCES private_rooms(id)
) ENGINE=InnoDB;

-- =====================================================
-- BACKUP HISTORY
-- =====================================================

CREATE TABLE backup_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  backup_type VARCHAR(30) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  size_bytes BIGINT UNSIGNED DEFAULT 0,
  status VARCHAR(30) NOT NULL,
  checksum CHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- SYSTEM SETTINGS
-- =====================================================

CREATE TABLE system_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- LOGIN ATTEMPTS
-- =====================================================

CREATE TABLE login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  identifier VARCHAR(190),
  ip_address VARCHAR(45),
  success BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_identifier(identifier, created_at),
  INDEX idx_login_ip(ip_address, created_at)
) ENGINE=InnoDB;

-- =====================================================
-- INITIAL ROLES
-- =====================================================

INSERT IGNORE INTO roles (name, description) VALUES
('SUPERADMIN', 'Control global de la plataforma'),
('ADMINISTRADOR', 'Administración autorizada'),
('USUARIO', 'Gestión de archivos propios');