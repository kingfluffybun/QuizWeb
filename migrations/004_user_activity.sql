-- =============================================================================
-- Migration: 004_user_activity.sql
-- Description: User activity, XP logging, and Streak Calendar persistence
-- Engine: MySQL 8.0+ / MariaDB 10.3+ / Azure Database for MySQL Flexible Server
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `user_activity_tbl` (
    `activity_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `activity_date` DATE NOT NULL,
    `activity_type` VARCHAR(50) NOT NULL DEFAULT 'quiz',
    `xp_earned` INT NOT NULL DEFAULT 10,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_activity_user_date` (`user_id`, `activity_date`),
    INDEX `idx_activity_date` (`activity_date`),
    CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

