-- =============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Baseline idempotent schema creation for QuizWeb application
-- Engine: MySQL 8.0+ / MariaDB 10.3+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Authentication & User Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_auth_tbl` (
    `user_id` INT AUTO_INCREMENT PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NULL,
    `is_email_verified` TINYINT(1) NOT NULL DEFAULT 0,
    `user_role` VARCHAR(50) NOT NULL DEFAULT 'user',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `player_tbl` (
    `user_id` INT NOT NULL UNIQUE,
    `username` VARCHAR(100) NOT NULL UNIQUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    CONSTRAINT `fk_player_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_oauth_tbl` (
    `oauth_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `provider_name` VARCHAR(50) NOT NULL,
    `provider_account_id` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_provider_account` (`provider_name`, `provider_account_id`),
    INDEX `idx_oauth_user_id` (`user_id`),
    CONSTRAINT `fk_oauth_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_vrfy_tbl` (
    `verify_id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `verification_token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_vrfy_token` (`verification_token`),
    INDEX `idx_vrfy_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_otp_tbl` (
    `otp_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `otp_code` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `is_used` INT NOT NULL DEFAULT 0,
    `purpose` VARCHAR(50) NOT NULL DEFAULT 'password_reset',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_otp_user_purpose` (`user_id`, `purpose`),
    CONSTRAINT `fk_otp_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rate_limit_tbl` (
    `limit_key` VARCHAR(255) PRIMARY KEY,
    `attempts` INT NOT NULL DEFAULT 0,
    `reset_at` BIGINT NOT NULL,
    `blocked` TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Quiz & Content Management Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `cat_tbl` (
    `cat_id` INT AUTO_INCREMENT PRIMARY KEY,
    `cat_name` VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sec_tbl` (
    `sec_id` INT AUTO_INCREMENT PRIMARY KEY,
    `sec_num` INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `difficulty_tbl` (
    `difficulty_id` INT AUTO_INCREMENT PRIMARY KEY,
    `difficulty_name` VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quiz_type_tbl` (
    `quiz_type_id` INT AUTO_INCREMENT PRIMARY KEY,
    `type_name` VARCHAR(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `quiz_tbl` (
    `quiz_id` INT AUTO_INCREMENT PRIMARY KEY,
    `cat_id` INT NULL,
    `sec_id` INT NULL,
    `difficulty_id` INT NULL,
    `quiz_type_id` INT NULL,
    `question_text` TEXT NULL,
    `quiz_payload` LONGTEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_quiz_cat` (`cat_id`),
    INDEX `idx_quiz_sec` (`sec_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `unit_tbl` (
    `unit_id` INT AUTO_INCREMENT PRIMARY KEY,
    `unit_title` VARCHAR(255) NULL,
    `sec_id` INT NULL,
    `unit_lesson_card_json` LONGTEXT NULL,
    `unit_quiz_json` LONGTEXT NULL,
    `unit_assessment_json` LONGTEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pending_tbl` (
    `pending_id` INT AUTO_INCREMENT PRIMARY KEY,
    `unit_title` VARCHAR(255) NULL,
    `sec_id` INT NULL,
    `unit_lesson_card_json` LONGTEXT NULL,
    `unit_quiz_json` LONGTEXT NULL,
    `unit_assessment_json` LONGTEXT NULL,
    `pending_status` VARCHAR(50) NULL DEFAULT 'pending',
    `pending_note` TEXT NULL,
    `pending_name` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `unit_approved_tbl` (
    `approved_id` INT AUTO_INCREMENT PRIMARY KEY,
    `pending_id` INT NULL,
    `unit_id` INT NULL,
    `approved_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_approved_pending` (`pending_id`),
    INDEX `idx_approved_unit` (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
