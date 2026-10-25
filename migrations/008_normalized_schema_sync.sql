-- =============================================================================
-- Migration: 008_normalized_schema_sync.sql
-- Description: Synchronizes and documents the full normalized relational schema
--              introduced in experimental_v2_quizweb_db:
--              - Unified unit lifecycle in `unit_tbl` (status, author_id, pending_note)
--              - Relational child tables: `lesson_slide_tbl`, `quiz_tbl`
--              - Subtype tables: `quiz_mcq_option_tbl`, `quiz_fitb_tbl`,
--                `quiz_order_item_tbl`, `quiz_pair_tbl`, `quiz_cp_tbl`, `quiz_cp_step_tbl`
--              - Assessment relations: `unit_assessment_tbl`, `assessment_step_tbl`
--              - Player state and Auth tables
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Core Lookup & Metadata Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `cat_tbl` (
  `cat_id` INT NOT NULL AUTO_INCREMENT,
  `cat_name` VARCHAR(100) NOT NULL COMMENT 'e.g., HTML, CSS, JavaScript',
  `is_active` TINYINT(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`cat_id`),
  UNIQUE KEY `uk_cat_name` (`cat_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sec_tbl` (
  `sec_id` INT NOT NULL AUTO_INCREMENT,
  `cat_id` INT NOT NULL COMMENT 'Parent category to prevent transitive dependency',
  `sec_num` INT NOT NULL,
  PRIMARY KEY (`sec_id`),
  UNIQUE KEY `uk_sec_cat_num` (`cat_id`, `sec_num`),
  KEY `idx_sec_cat_id` (`cat_id`),
  CONSTRAINT `fk_sec_cat` FOREIGN KEY (`cat_id`) REFERENCES `cat_tbl` (`cat_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `quiz_type_tbl` (
  `quiz_type_id` INT NOT NULL AUTO_INCREMENT,
  `type_name` VARCHAR(50) NOT NULL COMMENT 'MCQ, FITB, Order, Pair, CP',
  PRIMARY KEY (`quiz_type_id`),
  UNIQUE KEY `uk_quiz_type_name` (`type_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `difficulty_tbl` (
  `difficulty_id` INT NOT NULL AUTO_INCREMENT,
  `difficulty_name` VARCHAR(50) NOT NULL COMMENT 'Beginner, Intermediate, Advanced',
  `xp_multiplier` DECIMAL(4,2) NOT NULL DEFAULT '1.00',
  PRIMARY KEY (`difficulty_id`),
  UNIQUE KEY `uk_difficulty_name` (`difficulty_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 2. User Authentication & Player State
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_auth_tbl` (
  `user_id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL COMMENT 'Nullable (Empty if Google-only user)',
  `is_email_verified` TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'True if OTP/Google verified',
  `user_role` VARCHAR(50) NOT NULL DEFAULT 'user',
  `avatar_color` VARCHAR(7) NOT NULL DEFAULT '#BFB8FF',
  `token_version` INT NOT NULL DEFAULT '1',
  `daily_xp_goal` INT NOT NULL DEFAULT '50',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_user_auth_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `player_tbl` (
  `user_id` INT NOT NULL COMMENT 'PK, FK matches auth user_id',
  `username` VARCHAR(100) NOT NULL,
  `xp` INT NOT NULL DEFAULT '0',
  `max_streak` INT NOT NULL DEFAULT '0',
  `current_streak` INT NOT NULL DEFAULT '0',
  `last_quiz_date` DATE DEFAULT NULL,
  `hearts` INT NOT NULL DEFAULT '5',
  `gems` INT NOT NULL DEFAULT '50',
  `current_section` INT DEFAULT '1',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_player_username` (`username`),
  KEY `idx_player_xp` (`xp` DESC),
  KEY `idx_player_max_streak` (`max_streak` DESC),
  KEY `idx_player_current_section` (`current_section`),
  CONSTRAINT `fk_player_current_sec` FOREIGN KEY (`current_section`) REFERENCES `sec_tbl` (`sec_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_player_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_oauth_tbl` (
  `oauth_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `provider_name` VARCHAR(50) NOT NULL,
  `provider_account_id` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`oauth_id`),
  UNIQUE KEY `uk_oauth_provider_account` (`provider_name`, `provider_account_id`),
  KEY `idx_oauth_user_id` (`user_id`),
  CONSTRAINT `fk_oauth_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_vrfy_tbl` (
  `verification_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`verification_id`),
  UNIQUE KEY `uk_vrfy_token` (`token`),
  KEY `idx_vrfy_user_id` (`user_id`),
  CONSTRAINT `fk_vrfy_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_otp_tbl` (
  `otp_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `otp_code` VARCHAR(10) NOT NULL,
  `otp_type` VARCHAR(50) NOT NULL DEFAULT 'email_verification',
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`otp_id`),
  KEY `idx_otp_user_id` (`user_id`),
  CONSTRAINT `fk_otp_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `rate_limit_tbl` (
  `limit_key` VARCHAR(255) NOT NULL,
  `attempts` INT NOT NULL DEFAULT '0',
  `reset_at` BIGINT NOT NULL,
  `blocked` TINYINT(1) NOT NULL DEFAULT '0',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`limit_key`),
  KEY `idx_rate_limit_reset_at` (`reset_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_activity_tbl` (
  `activity_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `activity_type` VARCHAR(50) NOT NULL,
  `activity_date` DATE NOT NULL,
  `xp_earned` INT NOT NULL DEFAULT '0',
  `metadata` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`activity_id`),
  KEY `idx_activity_user_date` (`user_id`, `activity_date`),
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 3. Normalized Units, Slides, and Child Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `unit_tbl` (
  `unit_id` INT NOT NULL AUTO_INCREMENT,
  `sec_id` INT NOT NULL,
  `author_id` INT DEFAULT NULL,
  `unit_title` VARCHAR(255) NOT NULL,
  `lesson_format` VARCHAR(50) NOT NULL DEFAULT 'slides',
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `pending_note` TEXT,
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`unit_id`),
  UNIQUE KEY `uk_unit_title` (`unit_title`),
  KEY `idx_unit_sec_id` (`sec_id`),
  KEY `idx_unit_author_id` (`author_id`),
  KEY `idx_unit_status` (`status`),
  CONSTRAINT `fk_unit_author` FOREIGN KEY (`author_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_unit_sec` FOREIGN KEY (`sec_id`) REFERENCES `sec_tbl` (`sec_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `lesson_slide_tbl` (
  `slide_id` INT NOT NULL AUTO_INCREMENT,
  `unit_id` INT NOT NULL,
  `slide_order` INT NOT NULL,
  `slide_title` VARCHAR(255) NOT NULL,
  `slide_text` TEXT NOT NULL,
  `slide_code` TEXT,
  PRIMARY KEY (`slide_id`),
  UNIQUE KEY `uk_unit_slide_order` (`unit_id`, `slide_order`),
  CONSTRAINT `fk_slide_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit_tbl` (`unit_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 4. Quizzes & Specialized Subtype Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `quiz_tbl` (
  `quiz_id` INT NOT NULL AUTO_INCREMENT,
  `unit_id` INT NOT NULL,
  `difficulty_id` INT NOT NULL,
  `quiz_type_id` INT NOT NULL,
  `quiz_order` INT NOT NULL,
  `question_text` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`quiz_id`),
  UNIQUE KEY `uk_unit_quiz_order` (`unit_id`, `quiz_order`),
  UNIQUE KEY `uk_quiz_id_type` (`quiz_id`, `quiz_type_id`),
  KEY `idx_quiz_difficulty_id` (`difficulty_id`),
  KEY `idx_quiz_type_id` (`quiz_type_id`),
  CONSTRAINT `fk_quiz_difficulty` FOREIGN KEY (`difficulty_id`) REFERENCES `difficulty_tbl` (`difficulty_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_quiz_type` FOREIGN KEY (`quiz_type_id`) REFERENCES `quiz_type_tbl` (`quiz_type_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_quiz_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit_tbl` (`unit_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `quiz_mcq_option_tbl` (
  `option_id` INT NOT NULL AUTO_INCREMENT,
  `quiz_id` INT NOT NULL,
  `option_index` INT NOT NULL,
  `option_text` VARCHAR(500) NOT NULL,
  `is_correct` TINYINT(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`option_id`),
  UNIQUE KEY `uk_mcq_quiz_option_index` (`quiz_id`, `option_index`),
  CONSTRAINT `fk_mcq_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quiz_tbl` (`quiz_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `quiz_fitb_tbl` (
  `quiz_id` INT NOT NULL,
  `correct_answer` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`quiz_id`),
  CONSTRAINT `fk_fitb_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quiz_tbl` (`quiz_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `quiz_order_item_tbl` (
  `item_id` INT NOT NULL AUTO_INCREMENT,
  `quiz_id` INT NOT NULL,
  `canonical_order` INT NOT NULL,
  `item_text` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`item_id`),
  UNIQUE KEY `uk_order_quiz_canonical` (`quiz_id`, `canonical_order`),
  CONSTRAINT `fk_order_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quiz_tbl` (`quiz_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `quiz_pair_tbl` (
  `pair_id` INT NOT NULL AUTO_INCREMENT,
  `quiz_id` INT NOT NULL,
  `pair_order` INT NOT NULL DEFAULT '1',
  `left_text` VARCHAR(500) NOT NULL,
  `right_text` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`pair_id`),
  UNIQUE KEY `uk_pair_quiz_order` (`quiz_id`, `pair_order`),
  CONSTRAINT `fk_pair_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quiz_tbl` (`quiz_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `quiz_cp_tbl` (
  `quiz_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`quiz_id`),
  CONSTRAINT `fk_cp_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quiz_tbl` (`quiz_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `quiz_cp_step_tbl` (
  `cp_step_id` INT NOT NULL AUTO_INCREMENT,
  `quiz_id` INT NOT NULL,
  `step_order` INT NOT NULL,
  `prompt` TEXT NOT NULL,
  `template_code` TEXT,
  `expected_code` TEXT NOT NULL,
  PRIMARY KEY (`cp_step_id`),
  UNIQUE KEY `uk_cp_quiz_step_order` (`quiz_id`, `step_order`),
  CONSTRAINT `fk_cp_step_cp` FOREIGN KEY (`quiz_id`) REFERENCES `quiz_cp_tbl` (`quiz_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 5. Assessments & Steps
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `unit_assessment_tbl` (
  `assessment_id` INT NOT NULL AUTO_INCREMENT,
  `unit_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `expected_outcome` TEXT NOT NULL,
  PRIMARY KEY (`assessment_id`),
  UNIQUE KEY `uk_assessment_unit_id` (`unit_id`),
  CONSTRAINT `fk_assessment_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit_tbl` (`unit_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `assessment_step_tbl` (
  `step_id` INT NOT NULL AUTO_INCREMENT,
  `assessment_id` INT NOT NULL,
  `step_number` INT NOT NULL,
  `instruction` TEXT NOT NULL,
  `inherit_previous_code` TINYINT(1) NOT NULL DEFAULT '0',
  `starter_html` TEXT,
  `starter_css` TEXT,
  `starter_js` TEXT,
  `expected_html` TEXT,
  `expected_css` TEXT,
  `expected_js` TEXT,
  PRIMARY KEY (`step_id`),
  UNIQUE KEY `uk_assessment_step_number` (`assessment_id`, `step_number`),
  CONSTRAINT `fk_step_assessment` FOREIGN KEY (`assessment_id`) REFERENCES `unit_assessment_tbl` (`assessment_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 6. Lookup Seed Data (Idempotent)
-- -----------------------------------------------------------------------------

INSERT IGNORE INTO `cat_tbl` (`cat_id`, `cat_name`, `is_active`) VALUES
  (1, 'HTML', 1),
  (2, 'CSS', 1),
  (3, 'JavaScript', 1);

INSERT IGNORE INTO `sec_tbl` (`sec_id`, `cat_id`, `sec_num`) VALUES
  (1, 1, 1),
  (2, 1, 2),
  (3, 1, 3),
  (5, 2, 5),
  (6, 3, 6);

INSERT IGNORE INTO `quiz_type_tbl` (`quiz_type_id`, `type_name`) VALUES
  (1, 'MCQ'),
  (2, 'FITB'),
  (3, 'Order'),
  (4, 'Pair'),
  (5, 'CP');

INSERT IGNORE INTO `difficulty_tbl` (`difficulty_id`, `difficulty_name`, `xp_multiplier`) VALUES
  (1, 'Beginner', 1.00),
  (2, 'Intermediate', 2.00),
  (3, 'Advanced', 3.00);

SET FOREIGN_KEY_CHECKS = 1;
