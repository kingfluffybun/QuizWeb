-- =============================================================================
-- Migration: 006_player_quiz_stats.sql
-- Description: Persists player XP, quiz streaks, and most recent quiz date
-- Engine: MySQL 8.0+ / MariaDB 10.3+
-- =============================================================================

SET NAMES utf8mb4;

SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'player_tbl'
      AND COLUMN_NAME = 'xp'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `player_tbl` ADD COLUMN `xp` INT NOT NULL DEFAULT 0 AFTER `username`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'player_tbl'
      AND COLUMN_NAME = 'max_streak'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `player_tbl` ADD COLUMN `max_streak` INT NOT NULL DEFAULT 0 AFTER `xp`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'player_tbl'
      AND COLUMN_NAME = 'current_streak'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `player_tbl` ADD COLUMN `current_streak` INT NOT NULL DEFAULT 0 AFTER `max_streak`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'player_tbl'
      AND COLUMN_NAME = 'last_quiz_date'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `player_tbl` ADD COLUMN `last_quiz_date` DATE NULL AFTER `current_streak`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
