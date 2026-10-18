-- =============================================================================
-- Migration: 003_rbac_roles_rollback.sql
-- Description: Rollback script for Milestone 1 RBAC Roles & Content Attribution
-- Reverts:
--   1. Drops foreign key fk_pending_author from pending_tbl
--   2. Drops index idx_pending_author_id from pending_tbl
--   3. Drops column author_id from pending_tbl
--   4. Reverts pending_tbl.pending_note back to VARCHAR(50)
--   5. Reverts user_auth_tbl.user_role back to VARCHAR(10)
--   6. Removes 003_rbac_roles.sql from _migrations tracking table
-- Engine: MySQL 8.0+ / MariaDB 10.3+ / Azure Database for MySQL Flexible Server
-- Idempotency Pattern: Session Dynamic SQL via INFORMATION_SCHEMA (Zero DELIMITER issues)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- Step 1: Drop foreign key fk_pending_author if exists
-- -----------------------------------------------------------------------------
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pending_tbl' 
      AND CONSTRAINT_NAME = 'fk_pending_author' 
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_stmt = IF(
    @fk_exists > 0,
    'ALTER TABLE `pending_tbl` DROP FOREIGN KEY `fk_pending_author`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- Step 2: Drop index idx_pending_author_id if exists
-- -----------------------------------------------------------------------------
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pending_tbl' 
      AND INDEX_NAME = 'idx_pending_author_id'
);
SET @sql_stmt = IF(
    @idx_exists > 0,
    'ALTER TABLE `pending_tbl` DROP INDEX `idx_pending_author_id`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- Step 3: Drop column author_id if exists
-- -----------------------------------------------------------------------------
SET @author_col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pending_tbl' 
      AND COLUMN_NAME = 'author_id'
);
SET @sql_stmt = IF(
    @author_col_exists > 0,
    'ALTER TABLE `pending_tbl` DROP COLUMN `author_id`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- Step 4: Revert pending_tbl.pending_note back to VARCHAR(50) if it is TEXT
-- -----------------------------------------------------------------------------
SET @need_revert_note = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'pending_tbl' 
      AND COLUMN_NAME = 'pending_note' 
      AND DATA_TYPE = 'text'
);
SET @sql_stmt = IF(
    @need_revert_note > 0,
    'ALTER TABLE `pending_tbl` MODIFY COLUMN `pending_note` VARCHAR(50) NULL DEFAULT NULL',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- Step 5: Revert user_auth_tbl.user_role back to VARCHAR(10) if wider than 10
-- -----------------------------------------------------------------------------
SET @need_revert_role = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_auth_tbl' 
      AND COLUMN_NAME = 'user_role' 
      AND (DATA_TYPE = 'varchar' AND CHARACTER_MAXIMUM_LENGTH > 10)
);
SET @sql_stmt = IF(
    @need_revert_role > 0,
    'ALTER TABLE `user_auth_tbl` MODIFY COLUMN `user_role` VARCHAR(10) NOT NULL DEFAULT \'user\'',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- Step 6: Clean up _migrations record if present
-- -----------------------------------------------------------------------------
SET @mig_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = '_migrations'
);
SET @sql_stmt = IF(
    @mig_exists > 0,
    'DELETE FROM `_migrations` WHERE `name` = \'003_rbac_roles.sql\'',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
