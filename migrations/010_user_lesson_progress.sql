-- =============================================================================
-- Migration: 010_user_lesson_progress.sql
-- Description: Track per-user lesson slide progression and unit completion
--              in strict 3NF database normalization.
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `user_lesson_progress_tbl` (
  `progress_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `unit_id` INT NOT NULL,
  `current_slide_order` INT NOT NULL DEFAULT 1,
  `total_slides` INT NOT NULL DEFAULT 1,
  `is_completed` TINYINT(1) NOT NULL DEFAULT 0,
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `last_accessed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`progress_id`),
  UNIQUE KEY `uk_user_unit_progress` (`user_id`, `unit_id`),
  KEY `idx_progress_user_id` (`user_id`),
  KEY `idx_progress_unit_id` (`unit_id`),
  KEY `idx_progress_last_accessed` (`user_id`, `last_accessed_at` DESC),
  CONSTRAINT `fk_progress_user` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_progress_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit_tbl` (`unit_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
