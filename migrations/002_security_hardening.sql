-- =============================================================================
-- Migration: 002_security_hardening.sql
-- Description: Milestone 1 Security Hardening (SEC-12, ASVS 2.7.5, 3.4.2)
-- Changes:
--   1. Ensures core authentication tables exist (baseline fallback)
--   2. Idempotently adds `token_version` (INT NOT NULL DEFAULT 1) to `user_auth_tbl`
--   3. Idempotently adds `attempts` (INT NOT NULL DEFAULT 0) to `user_otp_tbl`
--   4. Idempotently adds `locked_until` (DATETIME NULL) to `user_otp_tbl`
--   5. Idempotently adds `attempts` (INT NOT NULL DEFAULT 0) to `user_vrfy_tbl`
--   6. Idempotently adds `locked_until` (DATETIME NULL) to `user_vrfy_tbl`
-- Engine: MySQL 8.0+ / MariaDB 10.3+
-- Idempotency Pattern: Session Dynamic SQL via INFORMATION_SCHEMA (Zero Delimiter issues)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- Step 1: Baseline Fallback - Ensure Tables Exist
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_auth_tbl` (
    `user_id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NULL,
    `is_email_verified` TINYINT(1) NOT NULL DEFAULT 0,
    `user_role` VARCHAR(50) NOT NULL DEFAULT 'user',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_otp_tbl` (
    `otp_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `otp_code` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `is_used` INT NOT NULL DEFAULT 0,
    `purpose` VARCHAR(50) NOT NULL DEFAULT 'password_reset',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_otp_user_purpose` (`user_id`, `purpose`),
    CONSTRAINT `fk_otp_user_hardening` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_vrfy_tbl` (
    `verify_id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `verification_token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_vrfy_token` (`verification_token`),
    INDEX `idx_vrfy_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rate_limit_tbl` (
    `limit_key` VARCHAR(255) PRIMARY KEY,
    `attempts` INT NOT NULL DEFAULT 0,
    `reset_at` BIGINT NOT NULL,
    `blocked` TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Step 2: Idempotent Column Additions
-- -----------------------------------------------------------------------------

-- 2.1 user_auth_tbl.token_version
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_auth_tbl' 
      AND COLUMN_NAME = 'token_version'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_auth_tbl` ADD COLUMN `token_version` INT NOT NULL DEFAULT 1 AFTER `user_role`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.2 user_otp_tbl.attempts
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_otp_tbl' 
      AND COLUMN_NAME = 'attempts'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_otp_tbl` ADD COLUMN `attempts` INT NOT NULL DEFAULT 0 AFTER `is_used`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.3 user_otp_tbl.locked_until
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_otp_tbl' 
      AND COLUMN_NAME = 'locked_until'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_otp_tbl` ADD COLUMN `locked_until` DATETIME NULL DEFAULT NULL AFTER `attempts`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.4 user_vrfy_tbl.attempts
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_vrfy_tbl' 
      AND COLUMN_NAME = 'attempts'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_vrfy_tbl` ADD COLUMN `attempts` INT NOT NULL DEFAULT 0 AFTER `expires_at`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.5 user_vrfy_tbl.locked_until
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_vrfy_tbl' 
      AND COLUMN_NAME = 'locked_until'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_vrfy_tbl` ADD COLUMN `locked_until` DATETIME NULL DEFAULT NULL AFTER `attempts`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
