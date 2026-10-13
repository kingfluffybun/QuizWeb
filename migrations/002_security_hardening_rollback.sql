-- =============================================================================
-- Migration: 002_security_hardening_rollback.sql
-- Description: Rollback script for Milestone 1 Security Hardening
-- Reverts: Drops token_version, attempts, and locked_until columns idempotently
-- Engine: MySQL 8.0+ / MariaDB 10.3+
-- Idempotency Pattern: Session Dynamic SQL via INFORMATION_SCHEMA
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop user_auth_tbl.token_version if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_auth_tbl' 
      AND COLUMN_NAME = 'token_version'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_auth_tbl` DROP COLUMN `token_version`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Drop user_otp_tbl.locked_until if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_otp_tbl' 
      AND COLUMN_NAME = 'locked_until'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_otp_tbl` DROP COLUMN `locked_until`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Drop user_otp_tbl.attempts if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_otp_tbl' 
      AND COLUMN_NAME = 'attempts'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_otp_tbl` DROP COLUMN `attempts`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Drop user_vrfy_tbl.locked_until if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_vrfy_tbl' 
      AND COLUMN_NAME = 'locked_until'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_vrfy_tbl` DROP COLUMN `locked_until`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Drop user_vrfy_tbl.attempts if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_vrfy_tbl' 
      AND COLUMN_NAME = 'attempts'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_vrfy_tbl` DROP COLUMN `attempts`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
