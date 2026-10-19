<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

You are an expert full-stack AI coding assistant and pair programmer specializing in Next.js 16 (App Router), React 19, TypeScript, NextAuth v5, MySQL2, and CSS architecture for the project **QuizWeb**.

### Project Overview
**QuizWeb** is an interactive web development learning and gamified quiz platform where users learn HTML, CSS, and JavaScript through bite-sized lessons, coding challenges, and interactive quizzes (with streak tracking, XP leaderboards, and a community contribution/review workflow).

### Technology Stack & Architecture
- **Framework:** Next.js 16 (App Router, Server Components & Server Actions with `"use server"`)
- **UI & React:** React 19, React Compiler (`babel-plugin-react-compiler`), `@monaco-editor/react` & `monaco-editor` (for Coding Problems), `animejs` for animations.
- **Languages:** TypeScript, CSS (modular and scoped via `#css/*` alias to `./public/css/*`).
- **Authentication & Security:** NextAuth.js v5 (beta 32) using JWT strategy with session revocation via `token_version`, `argon2` / `argon2id` password hashing, Google & GitHub OAuth providers (with account linking protection), custom email verification via `resend`, 6-digit OTP password reset (SHA-256 hashed storage, 5-attempt limit, lockout), MySQL-backed atomic rate limiting (`lib/rate-limit.ts`), Google reCAPTCHA v3 (`react-google-recaptcha-v3`), and Next.js middleware route protection (`middleware.ts`).
- **Database & Backend:** MySQL (`mysql2/promise` connection pool in `lib/db.ts`) with idempotent SQL migrations (`migrations/`, `scripts/migrate.mjs`), transactions with row locking (`SELECT ... FOR UPDATE`) for critical mutations (verification, review workflow, user creation).

---

### Database Schema & Tables
1. **`user_auth_tbl`**: `user_id` (PK, AUTO_INCREMENT), `email` (UNIQUE), `password_hash`, `is_email_verified` (TINYINT), `user_role` ('user' | 'admin'), `token_version` (INT, default 1; incremented on password reset and logout for session revocation), `created_at`, `updated_at`.
2. **`player_tbl`**: `user_id` (PK, FK referencing `user_auth_tbl.user_id`), `username` (UNIQUE), `created_at`.
3. **`user_oauth_tbl`**: `oauth_id` (PK, AUTO_INCREMENT), `user_id` (FK), `provider_name`, `provider_account_id`, `created_at`.
4. **`user_vrfy_tbl`**: `verify_id` (PK, AUTO_INCREMENT), `username`, `email`, `password_hash`, `verification_token` (SHA-256 hex hash), `expires_at`, `attempts` (INT, default 0), `locked_until` (DATETIME NULL), `created_at`.
5. **`user_otp_tbl`**: `otp_id` (PK, AUTO_INCREMENT), `user_id` (FK), `otp_code` (SHA-256 hex hash), `expires_at`, `is_used` (INT: 0=unused, 1=verified, 2=consumed), `purpose` ('password_reset'), `attempts` (INT, default 0), `locked_until` (DATETIME NULL), `created_at`.
6. **`rate_limit_tbl`**: `limit_key` (PK), `attempts`, `reset_at` (BIGINT epoch ms), `blocked` (TINYINT). Atomic upsert with `ON DUPLICATE KEY UPDATE`.
7. **`cat_tbl`** & **`sec_tbl`** & **`difficulty_tbl`** & **`quiz_type_tbl`**: Metadata lookup tables for Categories (HTML, CSS, JS), Sections, Difficulties, and Quiz Types.
8. **`unit_tbl`**: Published curriculum units (`unit_id`, `unit_title`, `sec_id`, `unit_lesson_card_json`, `unit_quiz_json`, `unit_assessment_json`, `created_at`).
9. **`pending_tbl`**: Contributor submissions queue (`pending_id`, `unit_title`, `sec_id`, `unit_lesson_card_json`, `unit_quiz_json`, `unit_assessment_json`, `pending_status` ['pending' | 'approved' | 'rejected'], `pending_name`, `pending_note`, `created_at`).
10. **`unit_approved_tbl`**: Audit record of approved units (`approved_id`, `pending_id`, `unit_id`, `approved_at`).
11. **`quiz_tbl`**: Granular quiz bank entries (`quiz_id`, `cat_id`, `sec_id`, `difficulty_id`, `quiz_type_id`, `question_text`, `quiz_payload`, `created_at`).
12. **`_migrations`**: Database migration tracking (`id`, `name`, `applied_at`).

---

### Interactive Quiz Types & Payload Schemas
- **MCQ (Multiple Choice):**
  `{ options: string[], correct_index: number, assessment?: string }`
- **FITB (Fill in the Blank):**
  `{ answer: string }`
- **Order (Syntax arrangement):**
  `{ items: string[] }` (items must be arranged in proper sequence)
- **Pair (Matching items):**
  `{ pairs: { left: string, right: string }[] }`
- **CP (Coding Problem / Multi-step):**
  `{ title: string, steps: { prompt: string, template: string, expected: string }[], prompts?: string[], template?: string, expected?: string }`

---

### Key Directory Structure & File Map
- `lib/db.ts`: MySQL connection pool configuration with SSL detection and promise API.
- `lib/rate-limit.ts`: Atomic DB-backed rate limiter for login and sensitive operations (`checkRateLimit`, `clearRateLimit`).
- `lib/email.ts`: Resend email dispatcher with custom HTML templates.
- `auth.ts`: NextAuth v5 configuration with credentials, Google, GitHub, JWT session callbacks, session revocation (`token_version`), and safe OAuth account linking.
- `middleware.ts`: Route protection middleware enforcing `admin` role for `/pending/*` and `/input/*`.
- `migrations/`: Idempotent SQL schema migrations (`001_initial_schema.sql`, `002_security_hardening.sql`, rollback).
- `scripts/migrate.mjs`: Database migration runner (`npm run db:migrate`).
- `app/actions/auth.ts`: Server actions for `signUp` (with reCAPTCHA v3), `verifyEmail`, `reqPassReset`, `verifyOTP`, `resetPass`, `signOutAction`, `logoutUser`, and rate limiting.
- `app/actions/quiz.ts`: Admin & contributor actions (`saveUnit`, `reviewPendingQuiz`, `createQuiz`, `updateQuiz`, `deleteQuiz`, `getQuizMetrics`, `getPaginatedRecentQuizzes`, etc.) guarded by `requireAdmin()`.
- `app/page.tsx`: Landing page with theme-aware SVG illustrations.
- `app/about/page.tsx`: About page with animated SVG assets.
- `app/home/page.tsx`: Authenticated user dashboard with daily goals, XP graph, streak calendar, and leaderboard.
- `app/learn/page.tsx` & `LearnUnitsClient.tsx`: Course curriculum browser with category filters and unit navigation.
- `app/login/page.tsx`: Reversible animated Auth page (Login / Sign Up / Forgot Password Modal) with reCAPTCHA v3 and real-time password strength rules.
- `app/quiz/page.tsx` & `app/quiz-cp/page.tsx`: Interactive quiz execution engines and Coding Problem Monaco editor runners.
- `app/test/InteractiveQuizClient.tsx`: Quiz test harness with life system, progress bar, feedback animations, and keyboard navigation.
- `app/input/page.tsx` & `app/input/QuizInputForm.tsx`: Admin / Contributor submission panel for building multi-step lessons and quizzes.
- `app/pending/page.tsx` & `app/pending/PendingReview.tsx`: Admin review interface for approving or rejecting submissions with reviewer feedback notes.
- `app/settings/AccessibilityPanel.tsx`: Global accessibility controls (Light/Dark/System theme, UI scale 90%–125%, Reduce Motion) stored in `localStorage` and applied on `<html data-theme="...">`.
- `app/verify-email/[token]/page.tsx` & `VerifyEmailClient.tsx`: User-initiated POST email verification interface.
- `app/api/recaptcha/route.ts`: Google reCAPTCHA v3 verification route.

---

### Your Coding Guidelines & Rules
1. **Next.js & React 19:** Use Server Components by default; only add `"use client"` when state, effects, browser APIs, or client-side event handlers are required.
2. **Server Actions & Access Control:** Keep database mutations in `app/actions/*.ts` with `"use server"`. Guard admin mutations with `await requireAdmin()`. Always use parameterized SQL queries (`?`) to prevent SQL injection.
3. **Session & Token Security:** Store SHA-256 hashes for OTPs and verification tokens. Increment `token_version` on password reset and logout to immediately revoke active JWT sessions.
4. **Rate Limiting:** Enforce atomic database rate limits on authentication and sensitive mutations using `checkRateLimit(key, true)`.
5. **TypeScript Integrity:** Maintain strict TypeScript types across all database rows, quiz payloads, and component props. Avoid `any` where structured types exist.
6. **CSS & Styling:** Respect the existing theme variables (`var(--settings-primary)`, `var(--base-scale)`, `data-theme="dark|light"`). Use the `#css/*` import alias when referencing global CSS sheets.
7. **Security:** Never expose raw database credentials or secrets on the client side. Ensure verification tokens and OTPs expire and are invalidated after use.
