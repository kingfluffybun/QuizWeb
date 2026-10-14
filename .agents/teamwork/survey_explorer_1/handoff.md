# Survey Phase Report: Codebase Architecture, Dependencies, Database Setup & Testing Harness

**Author**: Explorer 1  
**Working Directory**: `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/survey_explorer_1`  
**Milestone**: Survey Phase  
**Target Project Root**: `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management`  

---

## 1. Observation

### 1.1 Project Structure & Git Worktree Context
- Project root: `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management`
- Worktree git pointer (`.git` file):
  ```
  gitdir: /home/sankobite/QuizWeb/.git/worktrees/security_audit_session_management
  ```
  The primary Git repository is located at `/home/sankobite/QuizWeb`.
- File tree structure of worktree root:
  - `app/` (Next.js App Router application pages, components, server actions, API routes)
  - `auth.ts` (Next-Auth / Auth.js v5 beta configuration)
  - `lib/` (`db.ts`, `email.ts`, `rate-limit.ts`)
  - `public/` (CSS styles in `public/css/`, assets in `public/assets/`)
  - `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `README.md`
  - `.agents/teamwork/` (Teamwork coordination metadata)

### 1.2 Package.json, Dependencies, and Scripts
Inspection of `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/package.json`:
- **Package Name & Version**: `quizweb@0.1.0`
- **Scripts**:
  ```json
  "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "eslint"
  }
  ```
  *Crucial finding*: There is **no `"test"` script** defined in `package.json`.
- **Runtime Dependencies**:
  - `next`: `^16.3.4` (Next.js 16 App Router)
  - `react`: `19.2.8`, `react-dom`: `19.2.8` (React 19)
  - `next-auth`: `^5.0.0-beta.32` (Auth.js v5 beta)
  - `mysql2`: `^3.23.3` (MySQL driver supporting promises and connection pooling)
  - `argon2`: `^0.45.1`, `argon2id`: `^1.0.1` (Password hashing)
  - `resend`: `^6.25.0` (Transactional email API)
  - `react-google-recaptcha-v3`: `^1.11.0` (Client-side reCAPTCHA v3 wrapper)
  - `@monaco-editor/react`: `^4.7.0`, `monaco-editor`: `^0.53.0`, `animejs`: `^4.5.0`
- **Development Dependencies**:
  - `@types/node`: `^20.19.43`, `@types/react`: `^19`, `@types/react-dom`: `^19`
  - `typescript`: `^5`
  - `eslint`: `^9`, `eslint-config-next`: `16.3.0`
  - `babel-plugin-react-compiler`: `1.0.0`
  *Crucial finding*: `tsx` is **not listed** in `dependencies` or `devDependencies`.

### 1.3 TypeScript & Next.js Configuration
- **`tsconfig.json`**:
  - Target: `ES2017`
  - Module: `esnext` with `moduleResolution: "bundler"`
  - Strict: `true`, `noEmit: true`
  - Path mapping: `"@/*": ["./*"]`
- **`package.json` Subpath Imports**:
  - `"imports": { "#css/*": "./public/css/*" }`
- **`next.config.ts`**:
  - React Compiler enabled: `reactCompiler: true`
  - Images remote patterns: `lh3.googleusercontent.com` and `avatars.githubusercontent.com`

### 1.4 Database Setup & Connection Management (`lib/db.ts`)
The entire application imports `db` from `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/lib/db.ts`:
```ts
import mysql from "mysql2/promise";

export const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
});
```
Key observations regarding `db`:
1. It uses `mysql2/promise` with `createPool`.
2. Connection parameters are read from environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
3. It enforces `ssl: { rejectUnauthorized: true }`.
4. There is no `.env` or `.env.local` present in the worktree root.
5. In the current execution environment, no local MySQL daemon is running on port 3306 (`connect ECONNREFUSED 127.0.0.1:3306` when querying without a running server).
6. Non-interactive `sudo` is unavailable (`sudo: interactive authentication is required`), precluding system package installation of MySQL daemon.

### 1.5 Database Schema & Table Inventory
A recursive search across git history and the entire repository confirms:
- **Zero `.sql` files or DDL migration files** exist anywhere in the repository.
- There are no `CREATE TABLE` statements in the codebase.
- The entire schema is currently implicit, defined only through SQL queries executed across `auth.ts`, `lib/rate-limit.ts`, `app/actions/auth.ts`, and `app/actions/quiz.ts`.

#### Referenced Tables and Inferred Schemas:
1. **`user_auth_tbl`** (Authentication Credentials):
   - `user_id`: INT AUTO_INCREMENT PRIMARY KEY
   - `email`: VARCHAR(255) NOT NULL UNIQUE
   - `password_hash`: VARCHAR(255) NULL
   - `is_email_verified`: TINYINT(1) DEFAULT 0
   - `user_role`: VARCHAR(50) DEFAULT 'user'
   - *Requirement R1 / SEC-05 Target*: Add `token_version INT DEFAULT 1`
2. **`player_tbl`** (User Profiles):
   - `user_id`: INT NOT NULL UNIQUE (FK -> `user_auth_tbl.user_id`)
   - `username`: VARCHAR(100) NOT NULL
3. **`user_oauth_tbl`** (OAuth Accounts):
   - `oauth_id`: INT AUTO_INCREMENT PRIMARY KEY
   - `user_id`: INT NOT NULL (FK -> `user_auth_tbl.user_id`)
   - `provider_name`: VARCHAR(50) NOT NULL ('google', 'github')
   - `provider_account_id`: VARCHAR(255) NOT NULL
4. **`user_vrfy_tbl`** (Email Verification Tokens):
   - `verify_id`: INT AUTO_INCREMENT PRIMARY KEY
   - `username`: VARCHAR(100) NOT NULL
   - `email`: VARCHAR(255) NOT NULL
   - `password_hash`: VARCHAR(255) NOT NULL
   - `verification_token`: VARCHAR(255) NOT NULL
   - `expires_at`: DATETIME NOT NULL
   - *Requirement R1 / SEC-12 Target*: Add `attempts INT DEFAULT 0`, `locked_until DATETIME NULL`, store SHA-256 hash of token.
5. **`user_otp_tbl`** (One-Time Password Tokens):
   - `otp_id`: INT AUTO_INCREMENT PRIMARY KEY
   - `user_id`: INT NOT NULL (FK -> `user_auth_tbl.user_id`)
   - `otp_code`: VARCHAR(255) NOT NULL
   - `expires_at`: DATETIME NOT NULL
   - `is_used`: INT DEFAULT 0 (0 = unused, 1 = invalidated, 2 = consumed in resetPass)
   - `purpose`: VARCHAR(50) NOT NULL ('password_reset')
   - *Requirement R1 / SEC-12 Target*: Add `attempts INT DEFAULT 0`, `locked_until DATETIME NULL`, store SHA-256 hash of OTP.
6. **`rate_limit_tbl`** (Rate Limiting Storage):
   - `limit_key`: VARCHAR(255) PRIMARY KEY
   - `attempts`: INT NOT NULL DEFAULT 0
   - `reset_at`: BIGINT NOT NULL (epoch ms)
   - `blocked`: TINYINT(1) NOT NULL DEFAULT 0
7. **Content / Quiz Tables** (in `app/actions/quiz.ts`):
   - `cat_tbl` (`cat_id`, `cat_name`)
   - `sec_tbl` (`sec_id`, `sec_num`)
   - `difficulty_tbl` (`difficulty_id`, `difficulty_name`)
   - `quiz_type_tbl` (`quiz_type_id`, `type_name`)
   - `quiz_tbl` (`quiz_id`, `cat_id`, `sec_id`, `difficulty_id`, `quiz_type_id`, `question_text`, `quiz_payload`)
   - `pending_tbl` (`pending_id`, `unit_title`, `sec_id`, `unit_lesson_card_json`, `unit_quiz_json`, `unit_assessment_json`, `pending_status`, `pending_note`, `pending_name`)
   - `unit_tbl` (`unit_id`, `unit_title`, `sec_id`, `unit_lesson_card_json`, `unit_quiz_json`, `unit_assessment_json`)
   - `unit_approved_tbl` (`approved_id`, `pending_id`, `unit_id`)

### 1.6 Query Execution Patterns Across the App
Two distinct query patterns exist:
1. **Direct Pool Queries (`db.query`)**:
   Used in `auth.ts`, `lib/rate-limit.ts`, `reqPassReset`, `verifyOTP`, `resetPass`, and read actions in `app/actions/quiz.ts`.
   Example: `const [rows] = await db.query<RowDataPacket[]>(sql, params);`
2. **Explicit Connection Transactions (`db.getConnection()`)**:
   Used in `app/actions/auth.ts:verifyEmail` (lines 197-300), `app/actions/quiz.ts:deleteUnit` (lines 624-647), and `app/actions/quiz.ts:reviewPendingQuiz` (lines 1512-1584).
   Pattern:
   ```ts
   const connection = await db.getConnection();
   try {
       await connection.beginTransaction();
       // queries...
       await connection.commit();
   } catch (error) {
       await connection.rollback();
   } finally {
       connection.release();
   }
   ```

### 1.7 Node.js, Module Resolution, and Test Runner Environment
1. **Node & npm Versions**:
   - `node`: `v22.22.1`
   - `npm`: `9.2.0`
2. **Worktree `node_modules` Status**:
   - `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/node_modules` does **not exist**.
   - `/home/sankobite/QuizWeb/node_modules` **does exist** with 319 packages.
   - When running commands in the worktree root without `node_modules`, ESM imports fail (`Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'eslint'`).
   - `NODE_PATH` only works for CommonJS `require()`, not ESM `import`.
   - Running `ln -s /home/sankobite/QuizWeb/node_modules ./node_modules` or running `npm install` inside the worktree is mandatory for Next.js build, ESLint, and test execution.
3. **`tsx` Execution**:
   - `tsx` is not installed locally. Invoking `npx tsx` prompts interactively: `Need to install the following packages: tsx@4.23.15. Ok to proceed? (y)`.
   - Invoking `npx --yes tsx` succeeds non-interactively (`tsx v4.23.15`).
   - Installing `tsx` in `devDependencies` will eliminate the download overhead during automated verification.
4. **Mocking `db` in Standalone Tests**:
   - The `db` exported by `lib/db.ts` is an instantiated `mysql2` Pool object.
   - Verified that `db.query` and `db.getConnection` can be mocked/intercepted in-process by test runners (e.g. `db.query = async (...) => ...`), allowing standalone verification scripts (`tests/test-m1.ts` through `tests/test-m5.ts`) to execute without requiring an external running MySQL server.

---

## 2. Logic Chain

1. **Absence of `node_modules` in worktree**:
   - *Observation*: Git worktrees created via `git worktree add` do not copy `.gitignore`'d folders like `node_modules`.
   - *Result*: Node.js cannot resolve `mysql2`, `next-auth`, `argon2`, or TypeScript definitions in the worktree.
   - *Inference*: Before running builds or test runners in the worktree, `node_modules` must be linked (`ln -s /home/sankobite/QuizWeb/node_modules ./node_modules`) or installed.

2. **Absence of Existing DDL / Migration Scripts**:
   - *Observation*: Not a single `.sql` file exists in the repo; tables were previously created out-of-band on a database named `test_quizweb_db`.
   - *Requirement*: Requirement R1 calls for versioned, idempotent SQL migration and rollback scripts under a `migrations/` directory.
   - *Inference*: Milestone 1 must provide `migrations/001_initial_schema.sql` (defining all existing tables if not present) and `migrations/002_security_hardening.sql` (adding `token_version`, `attempts`, `locked_until`, hashed token support), along with corresponding rollback scripts.

3. **Database Connectivity and Testing Strategy**:
   - *Observation*: `lib/db.ts` connects to `process.env.DB_HOST` with `ssl: { rejectUnauthorized: true }`. There is no local MySQL daemon running and `sudo` cannot be run non-interactively to install one.
   - *Requirement*: Standalone test scripts `tests/test-m1.ts` through `test-m5.ts` must execute reliably via `node` / `npx tsx`.
   - *Inference*: The test verification harness must support database mocking/virtualization (either by mocking `db.query`/`db.getConnection` or running a lightweight in-memory test harness), while verifying SQL syntax and logic deterministically.

4. **Testing Infrastructure in `package.json`**:
   - *Observation*: No `"test"` script exists; `tsx` is not in `devDependencies`; `npx tsx` prompts interactively unless `--yes` is specified.
   - *Inference*: To ensure automated test runners and CI/verification can run non-interactively, either add `tsx` to `package.json` devDependencies or execute tests with `npx --yes tsx tests/test-mX.ts`.

---

## 3. Caveats

1. **No External Database Credentials Available**: No `.env` file exists with credentials to the original `test_quizweb_db` server. All database testing must be self-contained or use a local mock harness.
2. **Read-Only Scope**: In accordance with the Explorer role, no modifications were made to application source files, package files, or worktree symlinks during this phase.

---

## 4. Conclusion

The QuizWeb repository is a modern Next.js 16 / React 19 / Auth.js v5 beta / TypeScript application using raw SQL via `mysql2/promise`.
Key findings for the remediation plan:
1. **Worktree Setup Requirement**: `node_modules` must be symlinked from `/home/sankobite/QuizWeb/node_modules` or installed via `npm install` before tests or builds can run.
2. **Schema Baseline Requirement**: Because no prior DDL exists in Git, the Milestone 1 migration scripts must author the complete, idempotent baseline DDL alongside the security hardening alterations (`token_version`, `attempts`, `locked_until`).
3. **Execution Harness**: Standalone tests in `tests/test-m1.ts` to `tests/test-m5.ts` can run with `npx --yes tsx tests/test-mX.ts` and can intercept/mock `db.query` and `db.getConnection` directly on `lib/db.ts` to test schema validation, rate-limiting algorithms, session callbacks, and concurrency protections deterministically.

---

## 5. Verification Method

To independently verify the observations made in this report:

1. **Verify worktree vs main repo `node_modules`**:
   ```bash
   ls -ld /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/node_modules
   ls -ld /home/sankobite/QuizWeb/node_modules
   ```
   *Expected result*: No such file for worktree; directory exists for main repo.

2. **Verify lack of DDL / SQL files**:
   ```bash
   find /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management -name "*.sql"
   ```
   *Expected result*: 0 results found.

3. **Verify `npx --yes tsx` execution and path alias resolution with `NODE_PATH`**:
   ```bash
   NODE_PATH=/home/sankobite/QuizWeb/node_modules npx --yes tsx -e "import { checkRateLimit } from '@/lib/rate-limit'; console.log(typeof checkRateLimit);"
   ```
   *Expected result*: Prints `function`.

4. **Verify database connection error without running MySQL daemon**:
   ```bash
   NODE_PATH=/home/sankobite/QuizWeb/node_modules npx --yes tsx -e "import { db } from '@/lib/db'; (async () => { try { await db.query('SELECT 1'); } catch (e) { console.log('DB error:', e.code); } finally { await db.end(); } })();"
   ```
   *Expected result*: Prints `DB error: ECONNREFUSED`.
