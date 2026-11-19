import type { RowDataPacket } from "mysql2";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isValidRole, type UserRole } from "@/lib/rbac";

export interface SessionContext {
  userId: number | null;
  email: string | null;
  name: string | null;
  role: UserRole;
  isAuthenticated: boolean;
}

interface TestAuthSessionShape {
  user?: {
    id?: string | number;
    email?: string | null;
    name?: string | null;
    role?: string;
    user_role?: string;
  };
}

function getTestAuthSession(): TestAuthSessionShape | null | undefined {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }
  return (
    globalThis as unknown as {
      __TEST_AUTH_SESSION__?: TestAuthSessionShape | null;
    }
  ).__TEST_AUTH_SESSION__;
}

export async function getSessionContext(): Promise<SessionContext> {
  const testSession = getTestAuthSession();
  const session =
    testSession !== undefined
      ? testSession
      : await auth().catch(() => null);

  if (!session?.user) {
    return {
      userId: null,
      email: null,
      name: null,
      role: "user",
      isAuthenticated: false,
    };
  }

  const parsedId = session.user.id ? Number(session.user.id) : NaN;
  const userId =
    Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const rawRole = session.user.role || session.user.user_role;
  const role: UserRole = isValidRole(rawRole) ? rawRole : "user";

  return {
    userId,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role,
    isAuthenticated: userId !== null || Boolean(session.user.email),
  };
}

export async function resolveUserId(explicitUserId?: number): Promise<number | null> {
  if (explicitUserId && Number.isInteger(explicitUserId) && explicitUserId > 0) {
    return explicitUserId;
  }
  const ctx = await getSessionContext();
  return ctx.userId;
}

export async function resolveUserRole(explicitUserId?: number): Promise<UserRole> {
  try {
    const testSession = getTestAuthSession();
    if (testSession !== undefined) {
      if (testSession === null) return "user";
      const testId = testSession.user?.id ? Number(testSession.user.id) : undefined;
      if (!explicitUserId || (testId !== undefined && testId === explicitUserId)) {
        const testRole = testSession.user?.role || testSession.user?.user_role;
        if (isValidRole(testRole)) return testRole;
      }
      if (!explicitUserId) return "user";
    }

    if (!explicitUserId) {
      const ctx = await getSessionContext();
      if (!ctx.userId) return "user";
      if (ctx.role !== "user") return ctx.role;
      explicitUserId = ctx.userId;
    } else {
      const ctx = await getSessionContext();
      if (ctx.userId === explicitUserId && ctx.role) {
        return ctx.role;
      }
    }

    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [explicitUserId],
    );
    const dbRole = rows?.[0]?.user_role;
    return isValidRole(dbRole) ? dbRole : "user";
  } catch {
    return "user";
  }
}
