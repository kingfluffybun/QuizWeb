-- =============================================================================
-- Migration Rollback: 011_curriculum_level_progression_rollback.sql
-- Description: Reverts curriculum level progression schema changes
-- Engine: MySQL 8.0+
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Drop foreign key constraint on sec_tbl
SET @fk_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sec_tbl'
      AND CONSTRAINT_NAME = 'fk_sec_difficulty'
);
SET @sql_stmt = IF(
    @fk_exists > 0,
    'ALTER TABLE `sec_tbl` DROP FOREIGN KEY `fk_sec_difficulty`',
    'DO 0'
);
PREPARE stmt_drop_fk FROM @sql_stmt;
EXECUTE stmt_drop_fk;
DEALLOCATE PREPARE stmt_drop_fk;

-- Remove columns from sec_tbl and unit_tbl if needed
ALTER TABLE `sec_tbl`
  DROP COLUMN IF EXISTS `sec_title`,
  DROP COLUMN IF EXISTS `difficulty_id`;

ALTER TABLE `unit_tbl`
  DROP COLUMN IF EXISTS `unit_order`,
  DROP COLUMN IF EXISTS `topics`;

DELETE FROM `_migrations` WHERE `name` = '011_curriculum_level_progression.sql';

SET FOREIGN_KEY_CHECKS = 1;
