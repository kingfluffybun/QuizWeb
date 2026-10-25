-- =============================================================================
-- Migration: 012_add_learning_goal_column.sql
-- Description: Idempotently adds `learning_goal` INT NOT NULL DEFAULT 50 to
--              `user_auth_tbl` and syncs baseline with `daily_xp_goal`.
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Step 1: Add learning_goal column if it does not exist
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_auth_tbl' 
      AND COLUMN_NAME = 'learning_goal'
);

SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_auth_tbl` ADD COLUMN `learning_goal` INT NOT NULL DEFAULT 50 AFTER `daily_xp_goal`',
    'DO 0'
);

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Synchronize initial learning_goal with daily_xp_goal
UPDATE `user_auth_tbl`
SET `learning_goal` = `daily_xp_goal`
WHERE `learning_goal` = 50 AND `daily_xp_goal` <> 50;

-- Step 3: Record migration in _migrations table if exists
INSERT IGNORE INTO `_migrations` (`name`) VALUES ('012_add_learning_goal_column.sql');

SET FOREIGN_KEY_CHECKS = 1;
