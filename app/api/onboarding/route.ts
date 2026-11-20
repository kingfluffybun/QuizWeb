import type { RowDataPacket } from "mysql2";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ALL_TUTORIAL_MODE_ORDER, type QuizHintMode } from "@/lib/quiz-ui-hints";
import {
  getOrCreateUserOnboardingState,
  markUserTutorialModeSeen,
  resetUserOnboardingTutorial,
  setUserTutorialEnabled,
} from "@/lib/server/onboarding";

const VALID_MODES = new Set<string>(ALL_TUTORIAL_MODE_ORDER);
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

async function resolveAuthenticatedUserId(): Promise<number | null> {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string | null } | undefined;
  if (!user) return null;

  const parsedId = user.id ? Number(user.id) : NaN;
  if (Number.isInteger(parsedId) && parsedId > 0) {
    return parsedId;
  }

  if (user.email) {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
      [user.email],
    );
    const dbId = rows[0]?.user_id ? Number(rows[0].user_id) : NaN;
    if (Number.isInteger(dbId) && dbId > 0) {
      return dbId;
    }
  }

  return null;
}

export async function GET(): Promise<Response> {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    const state = await getOrCreateUserOnboardingState(userId);
    return Response.json(state, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Failed to load onboarding state:", error);
    return Response.json(
      { error: "Failed to load onboarding state" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    let body: {
      action?: string;
      mode?: string;
      completeWelcome?: boolean;
      enabled?: boolean;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const action = body?.action;
    if (action === "mark_seen") {
      if (typeof body.mode !== "string" || !VALID_MODES.has(body.mode)) {
        return Response.json(
          { error: "Invalid tutorial mode" },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      const next = await markUserTutorialModeSeen(
        userId,
        body.mode as QuizHintMode,
        Boolean(body.completeWelcome),
      );
      return Response.json(next, { headers: NO_STORE_HEADERS });
    }

    if (action === "complete_welcome") {
      const mode: QuizHintMode =
        typeof body.mode === "string" && VALID_MODES.has(body.mode)
          ? (body.mode as QuizHintMode)
          : "Home";
      const next = await markUserTutorialModeSeen(userId, mode, true);
      return Response.json(next, { headers: NO_STORE_HEADERS });
    }

    if (action === "set_enabled") {
      if (typeof body.enabled !== "boolean") {
        return Response.json(
          { error: "Boolean enabled flag is required" },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      const next = await setUserTutorialEnabled(userId, body.enabled);
      return Response.json(next, { headers: NO_STORE_HEADERS });
    }

    if (action === "reset") {
      const next = await resetUserOnboardingTutorial(userId);
      return Response.json(next, { headers: NO_STORE_HEADERS });
    }

    return Response.json(
      { error: "Unsupported onboarding action" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("Failed to update onboarding state:", error);
    return Response.json(
      { error: "Failed to update onboarding state" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
