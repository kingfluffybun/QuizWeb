-- =============================================================================
-- Migration: 014_cleanup_out_of_order_progress.sql
-- Description: Cleans up stray, uncompleted lesson progress records in
--              user_lesson_progress_tbl that violate the canonical curriculum
--              hierarchy, ensuring users resume strictly at their legitimate unit.
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Step 1: Remove uncompleted progress rows for units where the user has not completed
-- all prerequisites according to canonical sequence.
DELETE FROM `user_lesson_progress_tbl` WHERE `user_id` = 4 AND `unit_id` = 112;
DELETE FROM `user_lesson_progress_tbl` WHERE `user_id` = 10 AND `unit_id` IN (104, 110);

-- Step 2: Ensure user 4 current_section in player_tbl is aligned with active section 2
UPDATE `player_tbl`
SET `current_section` = 2
WHERE `user_id` = 4 AND (`current_section` IS NULL OR `current_section` <> 2);

-- Step 3: Record migration in _migrations table if exists
INSERT IGNORE INTO `_migrations` (`name`) VALUES ('014_cleanup_out_of_order_progress.sql');

SET FOREIGN_KEY_CHECKS = 1;
