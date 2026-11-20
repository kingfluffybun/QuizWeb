-- =============================================================================
-- Migration: 018_user_onboarding_tutorial.sql
-- Description: Adds `user_onboarding_tbl` to persist system-wide interactive
--              onboarding tutorial progress (first-login tour state, seen
--              walkthrough modes, and user auto-start preferences) per user.
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `user_onboarding_tbl` (
  `user_id` INT NOT NULL,
  `tutorial_enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `welcome_tour_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `seen_modes` JSON NOT NULL,
  `first_login_at` TIMESTAMP NULL DEFAULT NULL,
  `welcome_completed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_onboarding_user`
    FOREIGN KEY (`user_id`)
    REFERENCES `user_auth_tbl` (`user_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill pre-existing accounts so only newly registered users auto-launch
-- the system-wide first-login onboarding tour.
INSERT IGNORE INTO `user_onboarding_tbl` (
  `user_id`,
  `tutorial_enabled`,
  `welcome_tour_completed`,
  `seen_modes`,
  `welcome_completed_at`
)
SELECT
  u.`user_id`,
  1,
  1,
  JSON_ARRAY('Home', 'Learn'),
  CURRENT_TIMESTAMP
FROM `user_auth_tbl` u;

INSERT IGNORE INTO `_migrations` (`name`) VALUES ('018_user_onboarding_tutorial.sql');

SET FOREIGN_KEY_CHECKS = 1;
