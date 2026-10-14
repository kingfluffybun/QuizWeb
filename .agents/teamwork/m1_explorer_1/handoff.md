# Handoff Report: Milestone 1 Database Schema & Token Storage Hardening (SEC-12)

**Author**: Explorer 1 (`m1_explorer_1`)  
**Date**: 2026-10-12T19:20:00Z  
**Objective**: Investigate and design the exact idempotent SQL migration scripts and rollback scripts for Milestone 1 under `migrations/`, including baseline schema support and MySQL idempotency mechanisms.

---

## 1. Observation

### 1.1 Existing Database Assets & DDL Status
- A comprehensive search of the repository confirms **zero `.sql` files exist** across the workspace:
  ```bash
  find . -name "*.sql"
  # Output: 0 results found
  ```
- All table structures are currently implicit, defined solely by raw SQL queries in application code:
  - `auth.ts:29-50, 78-115`: References `user_auth_tbl`, `player_tbl`, `user_oauth_tbl`.
  - `app/actions/auth.ts:33-65, 201-285, 311-348, 484-528, 540-575`: References `user_auth_tbl`, `player_tbl`, `user_vrfy_tbl`, `user_otp_tbl`.
  - `lib/rate-limit.ts:18-107`: References `rate_limit_tbl`.
  - `app/actions/quiz.ts:115, 265-298, 415-449, 497-499, 628-632, 668-785`: References `cat_tbl`, `sec_tbl`, `difficulty_tbl`, `quiz_type_tbl`, `quiz_tbl`, `unit_tbl`, `pending_tbl`, `unit_approved_tbl`.

### 1.2 Cleartext Token Storage & Missing Columns (SEC-12)
Direct observation of `app/actions/auth.ts`:
- **Line 58-65** (`signUp`):
  ```ts
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);
  await db.query<ResultSetHeader>(
      `INSERT INTO user_vrfy_tbl (username, email, password_hash, verification_token, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [trimmedUsername, normalizedEmail, hashed, verificationToken, verificationExpires]
  )
  ```
  `user_vrfy_tbl` stores the raw 64-hex-char token directly in cleartext. It lacks `attempts` and `locked_until` columns.
- **Line 332-347** (`reqPassReset`):
  ```ts
  const otpCode = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await db.query(
      "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0",
      [userId, "password_reset"]
  );
  await db.query(
      "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose) VALUES (?, ?, ?, ?, ?)",
      [userId, otpCode, expiresAt, 0, "password_reset"]
  );
  ```
  `user_otp_tbl` stores the raw 6-digit numeric OTP code directly in cleartext. It lacks `attempts` and `locked_until` columns.
- **Lines 264-268** & `auth.ts:88-91`:
  `user_auth_tbl` is created/queried with `email`, `password_hash`, `is_email_verified`, `user_role`. It lacks the `token_version` column required for session revocation (SEC-05).

### 1.3 MySQL DDL Idempotency Constraints
- Standard MySQL (5.7, 8.0, 8.4 LTS) **does not support** `ALTER TABLE <tbl> ADD COLUMN IF NOT EXISTS <col>`. Attempting this syntax results in:
  `ERROR 1064 (42000): You have an error in your SQL syntax near 'IF NOT EXISTS'`
- Attempting to add an existing column results in:
  `ERROR 1060 (42S21): Duplicate column name '<column_name>'`
- Attempting to drop a non-existing column results in:
  `ERROR 1091 (42000): Can't DROP '<column_name>'; check that column/key exists`
- In MySQL, DDL statements cause an **implicit commit**. They cannot be grouped inside a rollable transaction (`START TRANSACTION` / `ROLLBACK`).

### 1.4 Database Driver (`mysql2`) Protocol Behavior
- `lib/db.ts` uses `mysql2/promise` with a connection pool.
- The `DELIMITER` command (e.g., `DELIMITER //`) is a MySQL Command-Line Client (CLI) instruction, not a server-side SQL statement. Sending `DELIMITER //` across the `mysql2` wire protocol causes a syntax parse error (`ER_PARSE_ERROR`). SQL scripts that must be executed programmatically via Node.js / `mysql2` or CLI without preprocessing should avoid `DELIMITER` switching or be structured into individual standard SQL statements.

---

## 2. Logic Chain

```
[Observation 1.1: 0 DDL files exist in repo]
       │
       ▼
(Inference: Need baseline schema `001_initial_schema.sql` + fallback table creation in `002_security_hardening.sql`)
       │
[Observation 1.2: Cleartext tokens + missing `token_version`, `attempts`, `locked_until`]
       │
       ▼
(Inference: Target columns must be:
  - `user_auth_tbl.token_version INT NOT NULL DEFAULT 1`
  - `user_otp_tbl.attempts INT NOT NULL DEFAULT 0`, `locked_until DATETIME NULL`
  - `user_vrfy_tbl.attempts INT NOT NULL DEFAULT 0`, `locked_until DATETIME NULL`)
       │
[Observation 1.3: MySQL 8.0 throws ERROR 1060 on duplicate ADD COLUMN and ERROR 1091 on invalid DROP COLUMN]
       │
       ▼
(Inference: Idempotency requires inspection of `information_schema.COLUMNS` before executing ALTER statements)
       │
[Observation 1.4: `DELIMITER //` is rejected by `mysql2` wire protocol]
       │
       ▼
(Inference: Primary migration pattern should use Session-Level Dynamic SQL (`PREPARE`/`EXECUTE`) with standard `;` delimiters, avoiding stored procedure delimiters)
```

### Detailed Inferences:
1. **Baseline Creation**: Because QuizWeb has never had versioned migrations, running tests or provisioning a new staging/production environment requires an idempotent initial schema script (`001_initial_schema.sql`) creating all 14 application tables using `CREATE TABLE IF NOT EXISTS`.
2. **Hardening Migration Fallback**: To satisfy the explicit requirement *"Also provide baseline idempotent schema if tables do not exist"*, `002_security_hardening.sql` must contain `CREATE TABLE IF NOT EXISTS` for all authentication-related tables prior to running the column checks. This guarantees the migration succeeds both when applied against a legacy existing database and when executed on a blank fresh database.
3. **Column Typing & Defaults**:
   - `token_version`: Must be `INT NOT NULL DEFAULT 1`. Setting `NOT NULL` prevents `null` comparisons in Auth.js callbacks (`token.tokenVersion !== dbUser.token_version`). Existing rows and new rows receive version 1.
   - `attempts`: Must be `INT NOT NULL DEFAULT 0` on both `user_otp_tbl` and `user_vrfy_tbl`.
   - `locked_until`: Must be `DATETIME NULL DEFAULT NULL`. When lockout triggers after 5 failed attempts, this is populated with the lockout expiration timestamp.
   - Token columns (`otp_code`, `verification_token`): Retained as `VARCHAR(255) NOT NULL`. SHA-256 hex strings are exactly 64 characters, fitting comfortably without truncation.
4. **Idempotency Strategy**:
   - Using session variables (`@col_exists`) querying `information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?` enables dynamic construction of `ALTER TABLE` or `DO 0` (no-op).
   - This approach is ANSI-compliant, requires no procedural permissions (`CREATE ROUTINE`), uses standard `;` statement terminators, and executes cleanly in `mysql` CLI, `mysql2`, DBeaver, or CI pipelines.

---

## 3. Caveats

1. **MySQL Implicit Commits**: In MySQL, `ALTER TABLE` and `CREATE TABLE` commit any open transaction immediately. The migration runner cannot wrap multiple DDL operations in a single atomic rollback transaction; idempotency at the statement level is therefore the sole protection against partial failure.
2. **Current Environment MySQL Daemon**: The local workspace lacks a running MySQL daemon on port 3306. Integration testing via `tests/test-m1.ts` should either target a live database if credentials are provided in `.env`, or mock database connections while executing SQL file validation.
3. **Alternative Stored Procedure Delimiter Nuance**: If an organization mandates stored procedures over dynamic SQL scripts, the stored procedure creation must be executed via `mysql` CLI or split cleanly by an application-level migration runner that strips `DELIMITER` statements before sending raw queries to `mysql2`. Both patterns are provided below.

---

## 4. Conclusion & Concrete Design Recommendations

### 4.1 Recommended Directory Structure
```
migrations/
├── 001_initial_schema.sql             # Full baseline schema (all 14 tables)
├── 002_security_hardening.sql          # Forward migration: adds token_version, attempts, locked_until
└── 002_security_hardening_rollback.sql # Rollback migration: drops added columns idempotently
```

---

### 4.2 Script 1: `migrations/001_initial_schema.sql` (Baseline Schema)

```sql
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
```

---

### 4.3 Script 2: `migrations/002_security_hardening.sql` (Forward Migration)

```sql
-- =============================================================================
-- Migration: 002_security_hardening.sql
-- Description: Milestone 1 Security Hardening (SEC-12, ASVS 2.7.5, 3.4.2)
-- Changes:
--   1. Ensures core authentication tables exist (baseline fallback)
--   2. Idempotently adds `token_version` (INT DEFAULT 1) to `user_auth_tbl`
--   3. Idempotently adds `attempts` (INT DEFAULT 0) to `user_otp_tbl`
--   4. Idempotently adds `locked_until` (DATETIME NULL) to `user_otp_tbl`
--   5. Idempotently adds `attempts` (INT DEFAULT 0) to `user_vrfy_tbl`
--   6. Idempotently adds `locked_until` (DATETIME NULL) to `user_vrfy_tbl`
-- Engine: MySQL 8.0+ / MariaDB 10.3+
-- Idempotency Pattern: Session Dynamic SQL via INFORMATION_SCHEMA (Zero Delimiter issues)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- Step 1: Baseline Fallback - Ensure Tables Exist
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

CREATE TABLE IF NOT EXISTS `user_otp_tbl` (
    `otp_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `otp_code` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `is_used` INT NOT NULL DEFAULT 0,
    `purpose` VARCHAR(50) NOT NULL DEFAULT 'password_reset',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_otp_user_purpose` (`user_id`, `purpose`),
    CONSTRAINT `fk_otp_user_hardening` FOREIGN KEY (`user_id`) REFERENCES `user_auth_tbl` (`user_id`) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS `rate_limit_tbl` (
    `limit_key` VARCHAR(255) PRIMARY KEY,
    `attempts` INT NOT NULL DEFAULT 0,
    `reset_at` BIGINT NOT NULL,
    `blocked` TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Step 2: Idempotent Column Additions
-- -----------------------------------------------------------------------------

-- 2.1 user_auth_tbl.token_version
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_auth_tbl' 
      AND COLUMN_NAME = 'token_version'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_auth_tbl` ADD COLUMN `token_version` INT NOT NULL DEFAULT 1 AFTER `user_role`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.2 user_otp_tbl.attempts
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_otp_tbl' 
      AND COLUMN_NAME = 'attempts'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_otp_tbl` ADD COLUMN `attempts` INT NOT NULL DEFAULT 0 AFTER `is_used`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.3 user_otp_tbl.locked_until
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_otp_tbl' 
      AND COLUMN_NAME = 'locked_until'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_otp_tbl` ADD COLUMN `locked_until` DATETIME NULL DEFAULT NULL AFTER `attempts`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.4 user_vrfy_tbl.attempts
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_vrfy_tbl' 
      AND COLUMN_NAME = 'attempts'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_vrfy_tbl` ADD COLUMN `attempts` INT NOT NULL DEFAULT 0 AFTER `expires_at`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.5 user_vrfy_tbl.locked_until
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_vrfy_tbl' 
      AND COLUMN_NAME = 'locked_until'
);
SET @sql_stmt = IF(
    @col_exists = 0,
    'ALTER TABLE `user_vrfy_tbl` ADD COLUMN `locked_until` DATETIME NULL DEFAULT NULL AFTER `attempts`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
```

---

### 4.4 Script 3: `migrations/002_security_hardening_rollback.sql` (Rollback Migration)

```sql
-- =============================================================================
-- Migration: 002_security_hardening_rollback.sql
-- Description: Rollback script for Milestone 1 Security Hardening
-- Reverts: Drops token_version, attempts, and locked_until columns idempotently
-- Engine: MySQL 8.0+ / MariaDB 10.3+
-- Idempotency Pattern: Session Dynamic SQL via INFORMATION_SCHEMA
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop user_auth_tbl.token_version if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_auth_tbl' 
      AND COLUMN_NAME = 'token_version'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_auth_tbl` DROP COLUMN `token_version`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Drop user_otp_tbl.locked_until if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_otp_tbl' 
      AND COLUMN_NAME = 'locked_until'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_otp_tbl` DROP COLUMN `locked_until`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Drop user_otp_tbl.attempts if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_otp_tbl' 
      AND COLUMN_NAME = 'attempts'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_otp_tbl` DROP COLUMN `attempts`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Drop user_vrfy_tbl.locked_until if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_vrfy_tbl' 
      AND COLUMN_NAME = 'locked_until'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_vrfy_tbl` DROP COLUMN `locked_until`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Drop user_vrfy_tbl.attempts if exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_vrfy_tbl' 
      AND COLUMN_NAME = 'attempts'
);
SET @sql_stmt = IF(
    @col_exists > 0,
    'ALTER TABLE `user_vrfy_tbl` DROP COLUMN `attempts`',
    'DO 0'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS = 1;
```

---

### 4.5 In-Depth Comparison of MySQL Idempotency Patterns

| Pattern | Mechanism | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **Pattern 1: Session-Level Dynamic SQL (Recommended)** | `SET @exists = ...; SET @sql = IF(@exists=0, 'ALTER...', 'DO 0'); PREPARE stmt FROM @sql; EXECUTE stmt;` | • Uses standard `;` terminators (zero `DELIMITER //` issues).<br>• Works in `mysql2`, CLI, CI scripts.<br>• Requires no stored routine permissions. | Slightly verbose per column. | **Primary Recommendation** for all `.sql` migration files. |
| **Pattern 2: Stored Procedure with `INFORMATION_SCHEMA`** | Temporary stored procedure checking `SELECT 1 FROM information_schema.COLUMNS` and executing prepared statement. | • Reusable helper routine.<br>• Clean procedure body. | • Requires `DELIMITER //` in CLI, which breaks `mysql2` wire protocol if run unparsed.<br>• Requires `CREATE ROUTINE` database privilege. | Good for CLI-only environments. |
| **Pattern 3: Stored Procedure with `CONTINUE HANDLER`** | Stored procedure declaring `DECLARE CONTINUE HANDLER FOR 1060 BEGIN END;` and issuing direct `ALTER TABLE`. | • Concise ALTER statements.<br>• Suppresses duplicate column errors automatically. | • Suppresses errors rather than checking state.<br>• Still requires `DELIMITER //` and stored procedure privileges. | Secondary alternative for DBA scripts. |

#### Alternative Stored Procedure Pattern (Pattern 2 Code Example for Reference):
If an implementer or deployment environment prefers procedural definitions:
```sql
DROP PROCEDURE IF EXISTS `add_col_if_missing`;
DELIMITER //
CREATE PROCEDURE `add_col_if_missing`(
    IN in_tbl VARCHAR(64),
    IN in_col VARCHAR(64),
    IN in_def VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = in_tbl AND COLUMN_NAME = in_col
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', in_tbl, '` ADD COLUMN `', in_col, '` ', in_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

CALL `add_col_if_missing`('user_auth_tbl', 'token_version', 'INT NOT NULL DEFAULT 1');
CALL `add_col_if_missing`('user_otp_tbl', 'attempts', 'INT NOT NULL DEFAULT 0');
CALL `add_col_if_missing`('user_otp_tbl', 'locked_until', 'DATETIME NULL');
CALL `add_col_if_missing`('user_vrfy_tbl', 'attempts', 'INT NOT NULL DEFAULT 0');
CALL `add_col_if_missing`('user_vrfy_tbl', 'locked_until', 'DATETIME NULL');
DROP PROCEDURE IF EXISTS `add_col_if_missing`;
```

---

## 5. Verification Method

To verify the migration designs independently:

### 5.1 Syntax & AST Validation
Validate that the SQL scripts are syntactically well-formed:
```bash
# Verify that all target SQL scripts contain expected table and column targets
grep -E "token_version|attempts|locked_until" migrations/002_security_hardening.sql
grep -E "DROP COLUMN" migrations/002_security_hardening_rollback.sql
```

### 5.2 Standalone Execution & Idempotency Testing
Once implemented, execute the migration twice consecutively against MySQL to verify exit code 0:
```bash
# 1. Apply baseline and forward migration
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < migrations/001_initial_schema.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < migrations/002_security_hardening.sql

# 2. Re-apply forward migration (MUST succeed without error 1060)
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < migrations/002_security_hardening.sql

# 3. Apply rollback migration twice consecutively (MUST succeed without error 1091)
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < migrations/002_security_hardening_rollback.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < migrations/002_security_hardening_rollback.sql

# 4. Re-apply forward migration to return to hardened state
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < migrations/002_security_hardening.sql
```

### 5.3 Schema Inspection Query
```sql
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND (
    (TABLE_NAME = 'user_auth_tbl' AND COLUMN_NAME = 'token_version') OR
    (TABLE_NAME = 'user_otp_tbl' AND COLUMN_NAME IN ('attempts', 'locked_until')) OR
    (TABLE_NAME = 'user_vrfy_tbl' AND COLUMN_NAME IN ('attempts', 'locked_until'))
  )
ORDER BY TABLE_NAME, COLUMN_NAME;
```
*Expected Result*:
- `user_auth_tbl`: `token_version` | `int` | `NO` | `1`
- `user_otp_tbl`: `attempts` | `int` | `NO` | `0`
- `user_otp_tbl`: `locked_until` | `datetime` | `YES` | `NULL`
- `user_vrfy_tbl`: `attempts` | `int` | `NO` | `0`
- `user_vrfy_tbl`: `locked_until` | `datetime` | `YES` | `NULL`
