CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  temporary_password_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  login_used_at DATETIME NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,

  INDEX idx_password_reset_user (user_id, created_at),
  INDEX idx_password_reset_expiry (expires_at),
  INDEX idx_password_reset_pending (
    user_id,
    login_used_at,
    used_at,
    expires_at
  )
) ENGINE=InnoDB;
