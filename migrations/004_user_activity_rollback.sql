-- =============================================================================
-- Migration Rollback: 004_user_activity_rollback.sql
-- Description: Rollback user activity and streak tracking table
-- Engine: MySQL 8.0+ / MariaDB 10.3+ / Azure Database for MySQL Flexible Server
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `user_activity_tbl`;

DELETE FROM `_migrations` WHERE `name` = '004_user_activity.sql';

SET FOREIGN_KEY_CHECKS = 1;

