-- =============================================================================
-- Migration: 013_fix_timezone_activity_dates.sql
-- Description: Corrects user_activity_tbl records where activity_date was stored
--              using UTC date instead of the local Asia/Manila (+08:00) date,
--              and synchronizes player_tbl.last_quiz_date.
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Step 1: Update activity_date to match Asia/Manila (+08:00) calendar date
UPDATE `user_activity_tbl`
SET `activity_date` = DATE(CONVERT_TZ(`created_at`, '+00:00', '+08:00'))
WHERE `activity_date` <> DATE(CONVERT_TZ(`created_at`, '+00:00', '+08:00'));

-- Step 2: Resynchronize player_tbl.last_quiz_date with the latest quiz activity
UPDATE `player_tbl` p
SET `last_quiz_date` = (
    SELECT MAX(a.activity_date) 
    FROM `user_activity_tbl` a 
    WHERE a.user_id = p.user_id AND a.activity_type = 'quiz'
)
WHERE EXISTS (
    SELECT 1 FROM `user_activity_tbl` a 
    WHERE a.user_id = p.user_id AND a.activity_type = 'quiz'
);

-- Step 3: Record migration in _migrations table if exists
INSERT IGNORE INTO `_migrations` (`name`) VALUES ('013_fix_timezone_activity_dates.sql');

SET FOREIGN_KEY_CHECKS = 1;
