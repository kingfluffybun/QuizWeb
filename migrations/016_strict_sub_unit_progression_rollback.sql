-- =============================================================================
-- Migration Rollback: 016_strict_sub_unit_progression_rollback.sql
-- Description: Drops is_lesson_completed, is_quiz_completed, and is_cp_completed
--              columns from `user_lesson_progress_tbl`.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

SET @col1_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user_lesson_progress_tbl'
      AND COLUMN_NAME = 'is_lesson_completed'
);
SET @sql_stmt1 = IF(
    @col1_exists > 0,
    'ALTER TABLE `user_lesson_progress_tbl` DROP COLUMN `is_lesson_completed`',
    'DO 0'
);
PREPARE stmt1 FROM @sql_stmt1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

SET @col2_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user_lesson_progress_tbl'
      AND COLUMN_NAME = 'is_quiz_completed'
);
SET @sql_stmt2 = IF(
    @col2_exists > 0,
    'ALTER TABLE `user_lesson_progress_tbl` DROP COLUMN `is_quiz_completed`',
    'DO 0'
);
PREPARE stmt2 FROM @sql_stmt2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @col3_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user_lesson_progress_tbl'
      AND COLUMN_NAME = 'is_cp_completed'
);
SET @sql_stmt3 = IF(
    @col3_exists > 0,
    'ALTER TABLE `user_lesson_progress_tbl` DROP COLUMN `is_cp_completed`',
    'DO 0'
);
PREPARE stmt3 FROM @sql_stmt3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

DELETE FROM `_migrations` WHERE `name` = '016_strict_sub_unit_progression.sql';

SET FOREIGN_KEY_CHECKS = 1;
