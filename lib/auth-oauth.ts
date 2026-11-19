import crypto from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export interface OAuthSignInUser {
  id?: string;
  email?: string | null;
  name?: string | null;
  role?: string;
  user_role?: string;
  token_version?: number;
  tokenVersion?: number;
  [key: string]: unknown;
}

export interface OAuthSignInAccount {
  provider?: string;
  providerAccountId?: string;
  type?: string;
  [key: string]: unknown;
}

function extractSessionTokenFromPairs(
  entries: Array<[string, string]>,
): { token?: string; isSecure: boolean } {
  const cookieMap = new Map<string, string>(entries);

  const directSecure = cookieMap.get("__Secure-authjs.session-token");
  if (directSecure) return { token: directSecure, isSecure: true };

  const directStandard = cookieMap.get("authjs.session-token");
  if (directStandard) return { token: directStandard, isSecure: false };

  const collectChunks = (prefix: string): string | undefined => {
    const chunks = entries
      .filter(([name]) => name.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([, val]) => val);
    return chunks.length > 0 ? chunks.join("") : undefined;
  };

  const secureChunked = collectChunks("__Secure-authjs.session-token.");
  if (secureChunked) return { token: secureChunked, isSecure: true };

  const standardChunked = collectChunks("authjs.session-token.");
  if (standardChunked) return { token: standardChunked, isSecure: false };

  return { token: undefined, isSecure: false };
}

/**
 * Retrieves the currently authenticated session user when linking OAuth accounts (SEC-04).
 */
export async function getActiveSessionUser(): Promise<{
  id: string;
  email?: string;
} | null> {
  if (process.env.NODE_ENV !== "production") {
    const testSession = (
      globalThis as unknown as {
        __TEST_AUTH_SESSION__?: { user?: { id?: string | number; email?: string } };
      }
    ).__TEST_AUTH_SESSION__;
    if (testSession?.user?.id) {
      return {
        id: String(testSession.user.id),
        email: testSession.user.email,
      };
    }
  }

  try {
    let sessionToken: string | undefined;
    let isSecure = false;

    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const extracted = extractSessionTokenFromPairs(
        cookieStore.getAll().map((c) => [c.name, c.value]),
      );
      sessionToken = extracted.token;
      isSecure = extracted.isSecure;
    } catch {
      // Outside cookie request scope
    }

    if (!sessionToken) {
      try {
        const { headers } = await import("next/headers");
        const headerList = await headers();
        const cookieHeader = headerList.get("cookie") || "";
        const pairs: Array<[string, string]> = cookieHeader
          .split(";")
          .map((part) => {
            const eqIdx = part.indexOf("=");
            if (eqIdx === -1) return ["", ""];
            const k = part.slice(0, eqIdx).trim();
            const rawVal = part.slice(eqIdx + 1).trim();
            try {
              return [k, decodeURIComponent(rawVal)];
            } catch {
              return [k, rawVal];
            }
          });
        const extracted = extractSessionTokenFromPairs(pairs);
        sessionToken = extracted.token;
        isSecure = extracted.isSecure;
      } catch {
        // Outside header scope
      }
    }

    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (sessionToken && secret) {
      const { decode } = await import("next-auth/jwt");
      const primarySalt = isSecure
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";
      const fallbackSalt = isSecure
        ? "authjs.session-token"
        : "__Secure-authjs.session-token";

      let decoded = await decode({
        token: sessionToken,
        secret,
        salt: primarySalt,
      });
      if (!decoded) {
        decoded = await decode({
          token: sessionToken,
          secret,
          salt: fallbackSalt,
        });
      }

      if (decoded) {
        const userId = decoded.id || decoded.sub;
        if (userId) {
          const [rows] = await db.query<RowDataPacket[]>(
            "SELECT token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
            [userId],
          );
          if (rows.length > 0) {
            const dbVer = Number(rows[0].token_version ?? 1);
            const dec = decoded as { tokenVersion?: number; token_version?: number };
            const tokenVer = Number(dec.tokenVersion ?? dec.token_version ?? 1);
            if (dbVer === tokenVer) {
              return {
                id: String(userId),
                email: decoded.email as string | undefined,
              };
            }
          }
        }
      }
    }
  } catch {
    // Fall through
  }

  return null;
}

async function insertPlayerWithUniqueUsername(
  conn: Awaited<ReturnType<typeof db.getConnection>>,
  userId: number,
  rawName: string | null | undefined,
): Promise<void> {
  const sanitizedBase = (rawName || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.\- ]/g, "")
    .slice(0, 24)
    .trim();
  const candidates = [
    sanitizedBase.length >= 3 ? sanitizedBase : `player_${userId}`,
    sanitizedBase.length >= 3
      ? `${sanitizedBase.slice(0, 20)}_${userId}`.slice(0, 30)
      : `player_${userId}_${crypto.randomBytes(2).toString("hex")}`,
    `player_${userId}_${crypto.randomBytes(3).toString("hex")}`.slice(0, 30),
  ];

  for (let i = 0; i < candidates.length; i++) {
    try {
      await conn.query(
        "INSERT INTO player_tbl (user_id, username) VALUES (?, ?)",
        [userId, candidates[i]],
      );
      return;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "ER_DUP_ENTRY" && i < candidates.length - 1) {
        continue;
      }
      throw err;
    }
  }
}

export async function handleOAuthSignIn(
  extUser: OAuthSignInUser,
  extAccount: OAuthSignInAccount,
): Promise<boolean> {
  if (!extUser.email) {
    console.warn("[OAuth] Rejected sign-in with missing email from provider:", extAccount.provider);
    return false;
  }

  try {
    const [existingUser] = await db.query<RowDataPacket[]>(
      "SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ? LIMIT 1",
      [extUser.email],
    );

    if (existingUser.length > 0) {
      const userId = existingUser[0].user_id;

      const [existingOAuth] = await db.query<RowDataPacket[]>(
        "SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ? LIMIT 1",
        [extAccount.provider, extAccount.providerAccountId],
      );

      if (existingOAuth.length > 0) {
        if (String(existingOAuth[0].user_id) !== String(userId)) {
          console.warn(
            `[SEC-04] Blocked cross-account OAuth takeover attempt: OAuth account linked to user ${existingOAuth[0].user_id}, but attempted sign-in for user ${userId}`,
          );
          return false;
        }
      } else {
        const activeSession = await getActiveSessionUser();
        if (!activeSession || String(activeSession.id) !== String(userId)) {
          console.warn(
            `[SEC-04] Blocked unauthenticated OAuth account linking attempt for email: ${extUser.email}`,
          );
          return false;
        }

        await db.query(
          "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
          [userId, extAccount.provider, extAccount.providerAccountId],
        );
      }

      const role = String(existingUser[0].user_role || "user");
      const tokenVer = Number(existingUser[0].token_version ?? 1);
      extUser.id = String(userId);
      extUser.role = role;
      extUser.user_role = role;
      extUser.token_version = tokenVer;
      extUser.tokenVersion = tokenVer;
      return true;
    }

    // New user creation wrapped in a single transaction to avoid orphaned auth rows
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [authResult] = await conn.query<ResultSetHeader>(
        "INSERT INTO user_auth_tbl (email, is_email_verified, token_version) VALUES (?, 1, 1)",
        [extUser.email],
      );
      const userId = authResult.insertId;

      await insertPlayerWithUniqueUsername(conn, userId, extUser.name);

      await conn.query(
        "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
        [userId, extAccount.provider, extAccount.providerAccountId],
      );

      await conn.commit();

      extUser.id = String(userId);
      extUser.role = "user";
      extUser.user_role = "user";
      extUser.token_version = 1;
      extUser.tokenVersion = 1;
      return true;
    } catch (txErr) {
      await conn.rollback().catch(() => {});
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Database error during OAuth sign-in:", error);
    return false;
  }
}
