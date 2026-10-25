-- =============================================================================
-- Migration: 009_leaderboard_activity_index.sql
-- Description: Adds covering index on user_activity_tbl for leaderboard and activity queries
-- Engine: MySQL 8.0+ / MariaDB 10.3+
-- =============================================================================

SET NAMES utf8mb4;

SET @idx_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user_activity_tbl'
      AND INDEX_NAME = 'idx_activity_date_user_xp'
);
SET @sql_stmt = IF(
    @idx_exists = 0,
    'ALTER TABLE `user_activity_tbl` ADD INDEX `idx_activity_date_user_xp` (`activity_date`, `user_id`, `xp_earned`)',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop redundant single-column index if present to ensure optimizer always uses covering index
SET @redundant_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user_activity_tbl'
      AND INDEX_NAME = 'idx_activity_date'
);
SET @drop_redundant = IF(
    @redundant_exists > 0,
    'ALTER TABLE `user_activity_tbl` DROP INDEX `idx_activity_date`',
    'DO 0'
);
PREPARE stmt_drop FROM @drop_redundant;
EXECUTE stmt_drop;
DEALLOCATE PREPARE stmt_drop;
