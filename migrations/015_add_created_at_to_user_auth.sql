-- =============================================================================
-- Migration: 015_add_created_at_to_user_auth.sql
-- Description: Idempotently adds `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
--              to `user_auth_tbl` and backfills from earliest user activity where available.
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Step 1: Add created_at column if it does not exist
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_auth_tbl' 
      AND COLUMN_NAME = 'created_at'
);

SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_auth_tbl` ADD COLUMN `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `learning_goal`',
    'DO 0'
);

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Backfill created_at from earliest user_activity_tbl entry if available
UPDATE `user_auth_tbl` u
JOIN (
    SELECT user_id, MIN(created_at) AS earliest_created
    FROM `user_activity_tbl`
    WHERE created_at IS NOT NULL
    GROUP BY user_id
) a ON u.user_id = a.user_id
SET u.created_at = a.earliest_created
WHERE a.earliest_created IS NOT NULL;

-- Step 3: Record migration in _migrations table if exists
INSERT IGNORE INTO `_migrations` (`name`) VALUES ('015_add_created_at_to_user_auth.sql');

SET FOREIGN_KEY_CHECKS = 1;
