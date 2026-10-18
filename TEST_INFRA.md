# E2E Test Infra: QuizWeb Multi-Tier RBAC & Dashboard System

## Test Philosophy
- Opaque-box, requirement-driven testing derived from `ORIGINAL_REQUEST.md` (2026-10-17T14:53:26Z).
- Systematic 4-tier approach (Category-Partition, Boundary Value Analysis, Pairwise Combinatorial Testing, Real-World Workload Testing).
- Standalone execution using `npx tsx tests/test-rbac-e2e.ts` without relying on browser automations.

## Feature Inventory & Test Matrix
| # | Feature | Requirement Source | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Scenario) |
|---|---------|-------------------|:-----------------:|:-----------------:|:---------------------:|:-----------------:|
| F1 | Change Username | ORIGINAL_REQUEST §R1 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F2 | Change Password (Local) | ORIGINAL_REQUEST §R1 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F3 | Set Password (OAuth) | ORIGINAL_REQUEST §R1 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F4 | Admin Secret Key Elevation | ORIGINAL_REQUEST §R3 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F5 | Staff Password Gating | ORIGINAL_REQUEST §R2 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F6 | Multi-Tier Route Protection | ORIGINAL_REQUEST §R6 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F7 | Live Session Role Sync | ORIGINAL_REQUEST §R4 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F8 | Admin User Management Table | ORIGINAL_REQUEST §R4 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F9 | Admin Review Queue Overview | ORIGINAL_REQUEST §R4 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F10 | Admin Platform Analytics | ORIGINAL_REQUEST §R4 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F11 | Maintainer Studio & Submissions | ORIGINAL_REQUEST §R5 | ≥5 cases | ≥5 cases | ✓ | ✓ |
| F12 | Navigation & Redirection | ORIGINAL_REQUEST §R6 | ≥5 cases | ≥5 cases | ✓ | ✓ |

## Test Architecture
- **Runner**: `npx tsx tests/test-rbac-e2e.ts`
- **Output**: Detailed TAP or structured console assertions with pass/fail counts and exit code 0.
- **Dependencies**: Uses `mysql2/promise`, `argon2`, `crypto`, and Next-Auth mock session harnesses matching `test-m1.ts`–`test-m5.ts`.

## Test Tiers

### Tier 1: Feature Coverage (≥5 per feature)
- F1: Valid username update, uppercase/lowercase, numbers, dashes, underscores.
- F2: Password change with valid current + new password conforming to complexity rules.
- F3: OAuth user setting password for the first time without current password.
- F4: Elevation with exact matching `ADMIN_SECRET_KEY` on password-backed account.
- F5: Rejection of OAuth-only account promotion to Maintainer/Admin with "Password Required".
- F6: Unauthenticated redirects to `/login` for `/admin`, `/maintainer`, `/pending`, `/input`.
- F7: Session reflects role changes from DB without modifying `token_version` or re-logging in.
- F8: Filter users by role (`admin`, `maintainer`, `user`) and password status (`Password Set`, `OAuth-Only`).
- F9: List pending submissions with count; approve and reject transitions.
- F10: Analytics aggregation of quizzes, categories, difficulties, and contributor counts.
- F11: Maintainer queries "My Submissions" and retrieves personal stats (approved/pending/rejected).
- F12: Role-based navigation renders correct links and post-login redirection targets.

### Tier 2: Boundary & Corner Cases (≥5 per feature)
- B1: Username length limits: 2 chars (too short), 3 chars (minimum valid), 30 chars (maximum valid), 31 chars (too long), invalid special characters (`<script>`, spaces at boundaries, symbols).
- B2: Password complexity boundaries: 7 chars (fail), 8 chars (pass), 24 chars (pass), 25 chars (fail), missing uppercase, missing lowercase, missing number, missing symbol.
- B3: OAuth account attempting password change via standard change-password action; local account attempting setPasswordForOAuth.
- B4: Secret key elevation with empty key, partial key, whitespace padding, incorrect key, rate limiting lockout after 5 failed attempts.
- B5: Demoting an admin; attempting to demote oneself; promoting already-maintainer account.
- B6: Route protection for nested subpaths (`/admin/settings/deep`, `/maintainer/quiz/new`), query param preservation on login redirect.
- B7: Concurrency: simultaneous promotions of the same user or simultaneous username changes with race condition checks.

### Tier 3: Cross-Feature Combinations (Pairwise Interaction)
- Pair 1: User changes username -> verifies username reflected across session, sidebar, and maintainer submissions.
- Pair 2: OAuth user sets password -> becomes immediately eligible for Maintainer promotion -> promoted by Admin.
- Pair 3: User elevated to Admin via secret key -> immediately gains access to `/admin` and `/pending` without re-login.
- Pair 4: Maintainer demoted to User by Admin -> immediately redirected/blocked when accessing `/maintainer` or `/input`.
- Pair 5: Multiple invalid secret key attempts trigger rate limit -> even valid secret key is temporarily locked out until reset.

### Tier 4: Real-World Application Scenarios
- Scenario 1 (Bootstrap & Staff Onboarding): Clean database bootstrap -> User claims Admin with secret key -> Promotes password-backed contributor to Maintainer -> Attempts to promote OAuth contributor (blocked with notice) -> OAuth contributor sets password in Settings -> Admin successfully promotes contributor to Maintainer.
- Scenario 2 (Maintainer Workflow): Maintainer logs in (redirects to `/maintainer`) -> authors question unit with MCQ & FITB -> unit enters `pending_tbl` with status `pending` -> Maintainer views submission in "My Submissions" -> Admin views review queue, provides feedback note, and approves -> Unit is moved to `unit_tbl`, Maintainer stats increment approved count.
- Scenario 3 (Security Breach Defense): Attacker attempts brute-forcing `ADMIN_SECRET_KEY` -> after 5 attempts, account locked for 15 minutes -> Attacker attempts accessing `/admin` as user -> redirected to `/home` with 403 logged.

## Coverage Thresholds
- Total test cases across Tiers 1-4: ≥ 130 tests.
- Exit code 0 required for all test suites.
- 100% pass rate before advancing to Tier 5 adversarial testing.
