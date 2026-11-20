import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { ALL_TUTORIAL_MODE_ORDER, type QuizHintMode } from "@/lib/quiz-ui-hints";

export interface OnboardingTutorialState {
  userId: number;
  tutorialEnabled: boolean;
  welcomeTourCompleted: boolean;
  seenModes: QuizHintMode[];
  isFirstLogin: boolean;
  source: "db" | "fallback";
}

interface OnboardingRow extends RowDataPacket {
  user_id: number;
  tutorial_enabled: number | boolean;
  welcome_tour_completed: number | boolean;
  seen_modes: unknown;
  first_login_at: Date | string | null;
  welcome_completed_at: Date | string | null;
}

const VALID_ALL_MODES = new Set<string>(ALL_TUTORIAL_MODE_ORDER);

function isMissingOnboardingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? (err as { code?: string }).code : undefined;
  const errno = "errno" in err ? (err as { errno?: number }).errno : undefined;
  return code === "ER_NO_SUCH_TABLE" || errno === 1146;
}

export function normalizeSeenTutorialModes(raw: unknown): QuizHintMode[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return Array.from(
    new Set(
      list.filter(
        (item): item is QuizHintMode =>
          typeof item === "string" && VALID_ALL_MODES.has(item),
      ),
    ),
  );
}

/**
 * Seeds a fresh `user_onboarding_tbl` row inside signup / OAuth creation
 * transactions. Gracefully no-ops if migration 018 has not been run yet.
 */
export async function initializeUserOnboardingRow(
  conn: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  userId: number,
): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0) return;
  try {
    await conn.query(
      `INSERT IGNORE INTO user_onboarding_tbl
         (user_id, tutorial_enabled, welcome_tour_completed, seen_modes)
       VALUES (?, 1, 0, JSON_ARRAY())`,
      [userId],
    );
  } catch (err) {
    if (isMissingOnboardingTableError(err)) {
      console.warn(
        "[onboarding] user_onboarding_tbl is missing; skipping onboarding row initialization until migration 018 runs.",
      );
      return;
    }
    throw err;
  }
}

async function hasUserPriorActivity(userId: number): Promise<boolean> {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
         EXISTS(SELECT 1 FROM user_lesson_progress_tbl WHERE user_id = ? LIMIT 1) AS has_lesson,
         EXISTS(SELECT 1 FROM user_activity_tbl WHERE user_id = ? LIMIT 1) AS has_activity`,
      [userId, userId],
    );
    const row = rows[0];
    return Boolean(Number(row?.has_lesson) || Number(row?.has_activity));
  } catch {
    return false;
  }
}

function rowToState(row: OnboardingRow): OnboardingTutorialState {
  const welcomeTourCompleted = Boolean(Number(row.welcome_tour_completed));
  return {
    userId: Number(row.user_id),
    tutorialEnabled: Boolean(Number(row.tutorial_enabled)),
    welcomeTourCompleted,
    seenModes: normalizeSeenTutorialModes(row.seen_modes),
    isFirstLogin: !welcomeTourCompleted,
    source: "db",
  };
}

export async function getOrCreateUserOnboardingState(
  userId: number,
): Promise<OnboardingTutorialState> {
  try {
    const [rows] = await db.query<OnboardingRow[]>(
      `SELECT user_id, tutorial_enabled, welcome_tour_completed, seen_modes,
              first_login_at, welcome_completed_at
       FROM user_onboarding_tbl
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );

    if (rows.length > 0) {
      const existing = rows[0];
      if (!existing.first_login_at) {
        await db.query(
          `UPDATE user_onboarding_tbl
           SET first_login_at = COALESCE(first_login_at, CURRENT_TIMESTAMP)
           WHERE user_id = ?`,
          [userId],
        );
      }
      return rowToState(existing);
    }

    const priorActivity = await hasUserPriorActivity(userId);
    if (!priorActivity) {
      await db.query(
        `INSERT IGNORE INTO user_onboarding_tbl
           (user_id, tutorial_enabled, welcome_tour_completed, seen_modes, first_login_at)
         VALUES (?, 1, 0, JSON_ARRAY(), CURRENT_TIMESTAMP)`,
        [userId],
      );
    } else {
      await db.query(
        `INSERT IGNORE INTO user_onboarding_tbl
           (user_id, tutorial_enabled, welcome_tour_completed, seen_modes, first_login_at, welcome_completed_at)
         VALUES (?, 1, 1, JSON_ARRAY('Home', 'Learn'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId],
      );
    }

    const [createdRows] = await db.query<OnboardingRow[]>(
      `SELECT user_id, tutorial_enabled, welcome_tour_completed, seen_modes,
              first_login_at, welcome_completed_at
       FROM user_onboarding_tbl
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    if (createdRows.length > 0) {
      return rowToState(createdRows[0]);
    }

    return {
      userId,
      tutorialEnabled: true,
      welcomeTourCompleted: priorActivity,
      seenModes: priorActivity ? ["Home", "Learn"] : [],
      isFirstLogin: !priorActivity,
      source: "db",
    };
  } catch (err) {
    if (isMissingOnboardingTableError(err)) {
      const priorActivity = await hasUserPriorActivity(userId);
      return {
        userId,
        tutorialEnabled: true,
        welcomeTourCompleted: priorActivity,
        seenModes: [],
        isFirstLogin: !priorActivity,
        source: "fallback",
      };
    }
    throw err;
  }
}

export async function markUserTutorialModeSeen(
  userId: number,
  mode: QuizHintMode,
  completeWelcome = false,
): Promise<OnboardingTutorialState> {
  const current = await getOrCreateUserOnboardingState(userId);
  const nextSeen = current.seenModes.includes(mode)
    ? current.seenModes
    : [...current.seenModes, mode];
  const nextWelcomeCompleted =
    current.welcomeTourCompleted || mode === "Home" || completeWelcome;

  if (current.source === "fallback") {
    return {
      ...current,
      welcomeTourCompleted: nextWelcomeCompleted,
      seenModes: nextSeen,
      isFirstLogin: !nextWelcomeCompleted,
    };
  }

  try {
    await db.query(
      `UPDATE user_onboarding_tbl
       SET seen_modes = ?,
           welcome_tour_completed = CASE WHEN ? = 1 THEN 1 ELSE welcome_tour_completed END,
           welcome_completed_at = CASE WHEN ? = 1 THEN COALESCE(welcome_completed_at, CURRENT_TIMESTAMP) ELSE welcome_completed_at END
       WHERE user_id = ?`,
      [
        JSON.stringify(nextSeen),
        nextWelcomeCompleted ? 1 : 0,
        nextWelcomeCompleted ? 1 : 0,
        userId,
      ],
    );
    return {
      ...current,
      welcomeTourCompleted: nextWelcomeCompleted,
      seenModes: nextSeen,
      isFirstLogin: !nextWelcomeCompleted,
      source: "db",
    };
  } catch (err) {
    if (isMissingOnboardingTableError(err)) {
      return {
        ...current,
        welcomeTourCompleted: nextWelcomeCompleted,
        seenModes: nextSeen,
        isFirstLogin: !nextWelcomeCompleted,
        source: "fallback",
      };
    }
    throw err;
  }
}

export async function setUserTutorialEnabled(
  userId: number,
  enabled: boolean,
): Promise<OnboardingTutorialState> {
  const current = await getOrCreateUserOnboardingState(userId);
  if (current.source === "fallback") {
    return {
      ...current,
      tutorialEnabled: enabled,
    };
  }

  try {
    await db.query(
      `UPDATE user_onboarding_tbl
       SET tutorial_enabled = ?
       WHERE user_id = ?`,
      [enabled ? 1 : 0, userId],
    );
    return {
      ...current,
      tutorialEnabled: enabled,
      source: "db",
    };
  } catch (err) {
    if (isMissingOnboardingTableError(err)) {
      return {
        ...current,
        tutorialEnabled: enabled,
        source: "fallback",
      };
    }
    throw err;
  }
}

export async function resetUserOnboardingTutorial(
  userId: number,
): Promise<OnboardingTutorialState> {
  const current = await getOrCreateUserOnboardingState(userId);
  if (current.source === "fallback") {
    return {
      ...current,
      tutorialEnabled: true,
      welcomeTourCompleted: false,
      seenModes: [],
      isFirstLogin: true,
    };
  }

  try {
    await db.query(
      `UPDATE user_onboarding_tbl
       SET tutorial_enabled = 1,
           welcome_tour_completed = 0,
           welcome_completed_at = NULL,
           seen_modes = JSON_ARRAY()
       WHERE user_id = ?`,
      [userId],
    );
    return {
      userId,
      tutorialEnabled: true,
      welcomeTourCompleted: false,
      seenModes: [],
      isFirstLogin: true,
      source: "db",
    };
  } catch (err) {
    if (isMissingOnboardingTableError(err)) {
      return {
        userId,
        tutorialEnabled: true,
        welcomeTourCompleted: false,
        seenModes: [],
        isFirstLogin: true,
        source: "fallback",
      };
    }
    throw err;
  }
}
