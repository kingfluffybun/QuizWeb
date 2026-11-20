-- =============================================================================
-- Rollback for 018_user_onboarding_tutorial.sql
-- Drops `user_onboarding_tbl` and removes the migration record.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `user_onboarding_tbl`;

DELETE FROM `_migrations`
WHERE `name` = '018_user_onboarding_tutorial.sql';

SET FOREIGN_KEY_CHECKS = 1;
