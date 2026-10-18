-- =============================================================================
-- Migration: 003_rbac_roles.sql
-- Description: Milestone 1 RBAC Roles & Content Attribution Schema Hardening
-- Changes:
--   1. Ensures baseline tables exist (user_auth_tbl, pending_tbl)
--   2. Idempotently widens user_auth_tbl.user_role to VARCHAR(50) NOT NULL DEFAULT 'user'
--   3. Idempotently alters pending_tbl.pending_note to TEXT NULL DEFAULT NULL
--   4. Idempotently adds author_id (INT NULL DEFAULT NULL) to pending_tbl
--   5. Idempotently adds index idx_pending_author_id on pending_tbl(author_id)
--   6. Idempotently adds foreign key fk_pending_author on pending_tbl(author_id)
--      referencing user_auth_tbl(user_id) ON DELETE SET NULL
-- Engine: MySQL 8.0+ / MariaDB 10.3+ / Azure Database for MySQL Flexible Server
-- Idempotency Pattern: Session Dynamic SQL via INFORMATION_SCHEMA (Zero DELIMITER issues)
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
    `token_version` INT NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pending_tbl` (
    `pending_id` INT AUTO_INCREMENT PRIMARY KEY,
    `unit_title` VARCHAR(255) NULL,
    `sec_id` INT NULL,
    `unit_lesson_card_json` LONGTEXT NULL,
    `unit_quiz_json` LONGTEXT NULL,
    `unit_assessment_json` LONGTEXT NULL,
    `pending_status` VARCHAR(50) NULL DEFAULT 'pending',
    `pending_note` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    `pending_name` VARCHAR(255) NULL,
    `author_id` INT NULL DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Step 2: Idempotent Column Widening & Modification
-- -----------------------------------------------------------------------------

-- 2.1 Widen user_auth_tbl.user_role to VARCHAR(50) NOT NULL DEFAULT 'user'
SET @role_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_auth_tbl' 
      AND COLUMN_NAME = 'user_role'
);
SET @need_widen_role = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_auth_tbl' 
      AND COLUMN_NAME = 'user_role' 
      AND (DATA_TYPE != 'varchar' OR CHARACTER_MAXIMUM_LENGTH < 50)
);
SET @sql_stmt = CASE 
    WHEN @role_exists = 0 THEN 'ALTER TABLE `user_auth_tbl` ADD COLUMN `user_role` VARCHAR(50) NOT NULL DEFAULT \'user\''
    WHEN @need_widen_role > 0 THEN 'ALTER TABLE `user_auth_tbl` MODIFY COLUMN `user_role` VARCHAR(50) NOT NULL DEFAULT \'user\''
    ELSE 'DO 0'
END;
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.2 Alter pending_tbl.pending_note to TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL
SET @note_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pending_tbl' 
      AND COLUMN_NAME = 'pending_note'
);
SET @need_alter_note = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pending_tbl' 
      AND COLUMN_NAME = 'pending_note' 
      AND (
        DATA_TYPE != 'text' 
        OR CHARACTER_SET_NAME != 'utf8mb4' 
        OR COLLATION_NAME != 'utf8mb4_unicode_ci'
      )
);
SET @sql_stmt = CASE 
    WHEN @note_exists = 0 THEN 'ALTER TABLE `pending_tbl` ADD COLUMN `pending_note` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL'
    WHEN @need_alter_note > 0 THEN 'ALTER TABLE `pending_tbl` MODIFY COLUMN `pending_note` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL'
    ELSE 'DO 0'
END;
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.3 Idempotently add author_id column to pending_tbl
SET @author_col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pending_tbl' 
      AND COLUMN_NAME = 'author_id'
);
SET @sql_stmt = IF(
    @author_col_exists = 0,
    'ALTER TABLE `pending_tbl` ADD COLUMN `author_id` INT NULL DEFAULT NULL AFTER `pending_name`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.4 Idempotently add index idx_pending_author_id on pending_tbl(author_id)
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pending_tbl' 
      AND (INDEX_NAME = 'idx_pending_author_id' OR (COLUMN_NAME = 'author_id' AND SEQ_IN_INDEX = 1))
);
SET @sql_stmt = IF(
    @idx_exists = 0,
    'ALTER TABLE `pending_tbl` ADD INDEX `idx_pending_author_id` (`author_id`)',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.5 Idempotently add foreign key fk_pending_author
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pending_tbl' 
      AND CONSTRAINT_NAME = 'fk_pending_author' 
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_stmt = IF(
    @fk_exists = 0,
    'ALTER TABLE `pending_tbl` ADD CONSTRAINT `fk_pending_author` FOREIGN KEY (`author_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE SET NULL',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
