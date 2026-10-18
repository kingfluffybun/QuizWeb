# Project: QuizWeb Multi-Tier RBAC & Dashboard System

## Architecture
QuizWeb is a Next.js (App Router, Node/Edge runtime) web application backed by MySQL (Azure Database for MySQL) and Next-Auth v5 (JWT session strategy). The system implements a three-tier Role-Based Access Control hierarchy: `admin`, `maintainer`, and `user` (default player).

```
                      [ Client Navigation / Browser ]
                                     │
                                     ▼
                        [ middleware.ts (Edge) ]
                 /admin, /pending  ──► admin only
                 /maintainer, /input ──► admin & maintainer
                 unauthenticated   ──► /login?callbackUrl=...
                 unauthorized      ──► /home (or 403 JSON)
                                     │
                     ┌───────────────┼───────────────┐
                     ▼               ▼               ▼
               /admin          /maintainer       /home, /settings
           [Admin Dashboard] [Maintainer Studio] [User Experience]
             - User/Role Mgmt  - Question Studio  - Username update
             - Review Queue    - My Submissions   - Password mgmt
             - Platform Stats  - Author Stats     - Dynamic Sidebar
                     │               │               │
                     └───────────────┼───────────────┘
                                     ▼
                     [ Server Actions (Node Runtime) ]
                       - app/actions/auth.ts (Next-Auth, Session)
                       - app/actions/credentials.ts (Username & Password)
                       - app/actions/admin.ts (Roles, Secret Key, Review)
                       - app/actions/maintainer.ts (Submissions, Stats)
                       - app/actions/quiz.ts (Quiz authoring, units)
                                     │
                                     ▼
                        [ MySQL (Azure Database) ]
             - user_auth_tbl (roles, password hashes, token_version)
             - player_tbl (usernames, player profiles)
             - pending_tbl (author_id, unit data, status, text notes)
             - unit_tbl, unit_approved_tbl (approved curriculum)
             - rate_limit_tbl (atomic lockout & brute-force defense)
```

## Feature Inventory
Every feature from ORIGINAL_REQUEST.md (2026-10-17T14:53:26Z) is mapped to its assigned milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Database Schema Hardening | Migrate `user_role` to VARCHAR(50), `pending_note` to TEXT, add `author_id` to `pending_tbl` with idempotent SQL scripts | M1 | Survey 1 & 3 |
| 2 | Live Session Role Sync | Query `user_role` in `auth.ts` session callback for immediate role reflection without re-login | M1 | Survey 1 & 2 |
| 3 | Staff Authorization Helpers | Provide `requireAdmin()` and `requireStaff()` / `requireMaintainerOrAdmin()` server utilities | M1 | Survey 2 |
| 4 | Username Change | Allow users to update username in settings with format validation (3-30 chars) and uniqueness check against `player_tbl` | M2 | R1 |
| 5 | Password Change (Local Accounts) | Allow users with passwords to change password after verifying current password, enforcing complexity | M2 | R1 |
| 6 | Password Set (OAuth Accounts) | Allow OAuth-only accounts (`password_hash IS NULL`) to set an initial password without current password | M2 | R1 |
| 7 | Admin Secret Key Elevation | Claim admin role using `ADMIN_SECRET_KEY` with constant-time comparison, atomic rate limiting, and password check | M2 | R3 |
| 8 | Multi-Tier Route Protection | Update `middleware.ts` to guard `/admin/*`, `/pending/*` (admin) and `/maintainer/*`, `/input/*` (maintainer+admin) | M3 | R6 |
| 9 | Dynamic Role-Aware Sidebar | Adapt `Sidebar.tsx` to display "Admin Panel", "Question Studio", and role badges (`Admin`, `Maintainer`) | M3 | R6 |
| 10 | Post-Login Workspace Redirection | Direct users to role primary workspace upon login: admin -> `/admin`, maintainer -> `/maintainer`, user -> `/home` | M3 | R6 |
| 11 | Maintainer Submission Attribution | Authoring questions/units attaches authenticated user `author_id` in `pending_tbl` | M3 | R5 |
| 12 | Admin User & Role Management Table | Search by email/username, filter by role and password status (`Password Set`, `OAuth-Only`), promote/demote | M4 | R4 |
| 13 | OAuth Password Gating Guard | Prevent promoting OAuth accounts without password to Maintainer/Admin, display "Password Required" notice | M4 | R2 |
| 14 | Admin Secret Key Elevation in UI | Require `ADMIN_SECRET_KEY` when promoting a user to Admin in the dashboard | M4 | R4 |
| 15 | Admin Review Queue Overview | Live count & list of pending submissions with inline/modal actions to approve or reject with feedback notes | M4 | R4 |
| 16 | Platform Analytics Overview | Total quizzes, category breakdown, difficulty breakdown, contributor metrics across units and quizzes | M4 | R4 |
| 17 | Maintainer Question Creation Studio | Link/embed quiz input tools to compose questions (MCQ, FITB, Pair, Order, CP steps) and lesson units | M5 | R5 |
| 18 | Maintainer "My Submissions" Tracker | Filterable table of submissions authored by current maintainer with status badges, feedback notes, edit/resubmit | M5 | R5 |
| 19 | Maintainer Personal Author Stats | Display personal counts of approved, pending, and total submissions on maintainer dashboard | M5 | R5 |
| 20 | E2E Acceptance Verification | Pass 100% of E2E test suite (Tiers 1-4), adversarial test hardening (Tier 5), zero TS errors (`tsc --noEmit`) | M6 | Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Database & Session Foundation | SQL migrations (003), `auth.ts` session live role sync, staff authorization helpers, env config | none | DONE (Verified: 003_rbac_roles.sql live applied, lib/rbac.ts fail-closed, auth.ts SEC-05 invariant, 342/342 tests pass) |
| 2 | Credential Management & Elevation | Change username, change/set password, secret key admin elevation with rate limiting, Settings UI | M1 | DONE (Verified: app/actions/credentials.ts, app/actions/admin.ts, app/settings/SettingsClient.tsx, 78/78 Ch1, 44/44 Ch2, 137/137 E2E pass) |
| 3 | Routing Guards & Dynamic Navigation | Middleware update (`/admin`, `/maintainer`, `/pending`, `/input`), Sidebar role badges & links, post-login routing | M1, M2 | DONE (Verified: middleware.ts multi-tier, Sidebar.tsx badges & tokens, lib/rbac.ts post-login, app/actions/quiz.ts author_id & pending_tbl schema, 18/18 Ch3, 143/143 Ch1, 137/137 E2E pass) |
| 4 | Dedicated Admin Dashboard | `/admin` page: User table (search/filter/promote), password guard, review queue overview, platform analytics | M1, M2, M3 | DONE (Verified: app/admin/*, app/actions/admin.ts, 0 Tailwind tokens, 72/72 Ch1, 26/26 Ch2, 30/30 Rev1, Rev2 APPROVE, Auditor CLEAN) |
| 5 | Dedicated Maintainer Studio | `/maintainer` page: Studio launcher, "My Submissions" filterable tracker, feedback viewer, author stats | M1, M3 | DONE (Verified: app/maintainer/*, app/actions/maintainer.ts, 100% vanilla CSS, 19/19 Rev1, Rev2 APPROVE, 25/25 Ch1, 23/23 Ch2, Auditor CLEAN) |
| 6 | E2E Testing, Adversarial Hardening & Victory Audit | Run 100% of E2E test suite (Tiers 1-4), Tier 5 adversarial tests, clean-room audit, `tsc --noEmit` clean | M1, M2, M3, M4, M5 | DONE (Verified: 137/137 E2E pass, 40/40 Auth stress pass, 23/23 Studio stress pass, 0 TS errors, 0 ESLint errors/warnings, Auditor CLEAN) |

## Interface Contracts

### Server Action Contracts (`app/actions/credentials.ts`)
- `updateUsername(newUsername: string): Promise<{ success: boolean; error?: string }>`
  - Validates format: `/^[a-zA-Z0-9_.\- ]{3,30}$/`.
  - Enforces uniqueness in `player_tbl` for `user_id != currentUser.id`.
- `changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ success: boolean; error?: string }>`
  - Requires user has existing `password_hash`.
  - Verifies `currentPassword` with `argon2.verify`.
  - Validates `newPassword` against security rules (8-24 chars, upper, lower, number, symbol).
  - Updates `user_auth_tbl` with `argon2.hash(newPassword)`.
- `setPasswordForOAuth(newPassword: string, confirmPassword: string): Promise<{ success: boolean; error?: string }>`
  - Validates user has `password_hash IS NULL`.
  - Validates complexity and updates `user_auth_tbl` with new hash.

### Server Action Contracts (`app/actions/admin.ts`)
- `claimAdminWithSecretKey(secretKey: string): Promise<{ success: boolean; error?: string }>`
  - Checks user has `password_hash IS NOT NULL`.
  - Rate limits with `checkRateLimit('admin_elevation:' + userId, true)`.
  - Constant-time comparison `crypto.timingSafeEqual` over SHA-256 digests against `process.env.ADMIN_SECRET_KEY`.
  - Updates `user_role = 'admin'` in `user_auth_tbl`.
- `promoteUser(targetUserId: number, targetRole: 'maintainer' | 'admin', adminSecretKey?: string): Promise<{ success: boolean; error?: string }>`
  - Caller must be `admin`.
  - Verifies target user has `password_hash IS NOT NULL` (rejects with "Password Required" if null).
  - If elevating to `admin`, verifies `adminSecretKey`.
  - Updates `user_role` in `user_auth_tbl`.
- `demoteUser(targetUserId: number): Promise<{ success: boolean; error?: string }>`
  - Caller must be `admin`. Cannot demote oneself.
  - Updates `user_role = 'user'`.
- `getAdminUsers(query?: string, roleFilter?: string, passwordFilter?: string): Promise<{ users: AdminUserRecord[] }>`
- `getAdminAnalytics(): Promise<PlatformAnalytics>`
- `getAdminReviewQueue(): Promise<PendingReviewItem[]>`

### Server Action Contracts (`app/actions/maintainer.ts`)
- `getMaintainerSubmissions(): Promise<{ submissions: MaintainerSubmission[] }>`
  - Filters by current maintainer's `user_id` (or fallback to `pending_name`).
- `getMaintainerStats(): Promise<{ approved: number; pending: number; rejected: number; total: number }>`

### Middleware & Navigation Contracts
- `middleware.ts`:
  - `adminPaths = ["/admin", "/pending"]`: requires `role === "admin"`.
  - `staffPaths = ["/maintainer", "/input"]`: requires `role === "admin" || role === "maintainer"`.
  - Redirection: unauthenticated -> `/login?callbackUrl=...`, unauthorized -> `/home`.
- `Sidebar.tsx`:
  - Accepts `role?: string` and `username?: string`.
  - Displays "Admin Panel" (`/admin`) for `admin`.
  - Displays "Question Studio" (`/maintainer`) for `admin` and `maintainer`.
  - Displays badge (`Admin` or `Maintainer`) beside profile.

## Code Layout
- `migrations/003_rbac_roles.sql`: Idempotent schema modifications.
- `migrations/003_rbac_roles_rollback.sql`: Rollback script.
- `auth.ts`: Next-Auth configuration with live role synchronization in `session()` callback.
- `middleware.ts`: Multi-tier route protection.
- `lib/rbac.ts`: Shared RBAC type definitions, role constants, and permission assertion helpers.
- `app/actions/credentials.ts`: Username and password server actions.
- `app/actions/admin.ts`: Administrative management server actions.
- `app/actions/maintainer.ts`: Maintainer studio server actions.
- `app/components/Sidebar.tsx`: Dynamic role-aware navigation component.
- `app/settings/page.tsx`: Settings UI with username and password management.
- `app/admin/`: Dedicated Admin Dashboard (`page.tsx`, `AdminUserTable.tsx`, `AdminReviewQueue.tsx`, `AdminAnalytics.tsx`).
- `app/maintainer/`: Dedicated Maintainer Studio (`page.tsx`, `MaintainerSubmissions.tsx`, `MaintainerStats.tsx`).
- `app/post-login/`: Server redirection resolver for post-login routing.
- `public/css/admin.css`: Admin dashboard styles using design tokens (no Tailwind).
- `public/css/maintainer.css`: Maintainer studio styles using design tokens (no Tailwind).
- `tests/test-rbac-e2e.ts`: Standalone E2E verification test harness.
