-- =============================================================================
-- Migration: 016_strict_sub_unit_progression.sql
-- Description: Idempotently adds granular sub-unit activity progression columns
--              (is_lesson_completed, is_quiz_completed, is_cp_completed) to
--              `user_lesson_progress_tbl` to enforce strict sequential unlocks:
--              Lesson -> Quiz -> Code Problem -> Next Unit Lesson.
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. is_lesson_completed
SET @col1_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user_lesson_progress_tbl'
      AND COLUMN_NAME = 'is_lesson_completed'
);
SET @sql_stmt1 = IF(
    @col1_exists = 0,
    'ALTER TABLE `user_lesson_progress_tbl` ADD COLUMN `is_lesson_completed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `total_slides`',
    'DO 0'
);
PREPARE stmt1 FROM @sql_stmt1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- 2. is_quiz_completed
SET @col2_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user_lesson_progress_tbl'
      AND COLUMN_NAME = 'is_quiz_completed'
);
SET @sql_stmt2 = IF(
    @col2_exists = 0,
    'ALTER TABLE `user_lesson_progress_tbl` ADD COLUMN `is_quiz_completed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_lesson_completed`',
    'DO 0'
);
PREPARE stmt2 FROM @sql_stmt2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 3. is_cp_completed
SET @col3_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user_lesson_progress_tbl'
      AND COLUMN_NAME = 'is_cp_completed'
);
SET @sql_stmt3 = IF(
    @col3_exists = 0,
    'ALTER TABLE `user_lesson_progress_tbl` ADD COLUMN `is_cp_completed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_quiz_completed`',
    'DO 0'
);
PREPARE stmt3 FROM @sql_stmt3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 4. Backfill existing progress records:
-- If the unit is already marked as completed, all three sub-activities are completed.
UPDATE `user_lesson_progress_tbl`
SET `is_lesson_completed` = 1,
    `is_quiz_completed` = 1,
    `is_cp_completed` = 1
WHERE `is_completed` = 1;

-- If slides have reached the total count, mark the lesson component as completed.
UPDATE `user_lesson_progress_tbl`
SET `is_lesson_completed` = 1
WHERE `current_slide_order` >= `total_slides` AND `total_slides` > 0;

-- 5. Record migration in _migrations table
INSERT IGNORE INTO `_migrations` (`name`) VALUES ('016_strict_sub_unit_progression.sql');

SET FOREIGN_KEY_CHECKS = 1;
