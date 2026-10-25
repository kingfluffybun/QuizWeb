-- =============================================================================
-- Migration Rollback: 009_leaderboard_activity_index_rollback.sql
-- Description: Drops covering index idx_activity_date_user_xp from user_activity_tbl
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
    @idx_exists > 0,
    'ALTER TABLE `user_activity_tbl` DROP INDEX `idx_activity_date_user_xp`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
