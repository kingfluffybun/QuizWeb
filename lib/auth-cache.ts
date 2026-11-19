import { cache } from "react";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export interface UserAuthRecord {
  user_role: string;
  token_version: number;
  username?: string;
  isMockNonArray?: boolean;
}

interface CachedAuthEntry {
  record: UserAuthRecord | null;
  expiresAt: number;
}

const AUTH_CACHE_TTL_MS = 20_000;
const MAX_AUTH_CACHE_SIZE = 10_000;
const MAX_GENERATION_MAP_SIZE = 20_000;

const globalForAuthCache = globalThis as unknown as {
  __userAuthMemoryCache?: Map<string, CachedAuthEntry>;
  __userAuthInflight?: Map<string, Promise<UserAuthRecord | null>>;
  __userAuthGeneration?: Map<string, number>;
  __globalAuthGeneration?: number;
};

const userAuthMemoryCache =
  globalForAuthCache.__userAuthMemoryCache ?? new Map<string, CachedAuthEntry>();
const inflightAuthQueries =
  globalForAuthCache.__userAuthInflight ?? new Map<string, Promise<UserAuthRecord | null>>();
const userAuthGeneration =
  globalForAuthCache.__userAuthGeneration ?? new Map<string, number>();

if (!globalForAuthCache.__userAuthMemoryCache) {
  globalForAuthCache.__userAuthMemoryCache = userAuthMemoryCache;
}
if (!globalForAuthCache.__userAuthInflight) {
  globalForAuthCache.__userAuthInflight = inflightAuthQueries;
}
if (!globalForAuthCache.__userAuthGeneration) {
  globalForAuthCache.__userAuthGeneration = userAuthGeneration;
}
if (globalForAuthCache.__globalAuthGeneration === undefined) {
  globalForAuthCache.__globalAuthGeneration = 0;
}

function pruneExpiredCacheEntries(now: number): void {
  for (const [key, entry] of userAuthMemoryCache.entries()) {
    if (entry.expiresAt <= now) {
      userAuthMemoryCache.delete(key);
    }
  }
  if (userAuthMemoryCache.size > MAX_AUTH_CACHE_SIZE) {
    let deleted = 0;
    for (const key of userAuthMemoryCache.keys()) {
      userAuthMemoryCache.delete(key);
      if (++deleted >= 1000) break;
    }
  }
}

export function invalidateUserAuthCache(userId?: string | number): void {
  if (userId !== undefined) {
    const idKey = String(userId);
    userAuthMemoryCache.delete(idKey);
    inflightAuthQueries.delete(idKey);
    if (userAuthGeneration.size >= MAX_GENERATION_MAP_SIZE && !userAuthGeneration.has(idKey)) {
      const oldestKey = userAuthGeneration.keys().next().value;
      if (oldestKey !== undefined) {
        userAuthGeneration.delete(oldestKey);
      }
    }
    userAuthGeneration.set(idKey, (userAuthGeneration.get(idKey) ?? 0) + 1);
  } else {
    userAuthMemoryCache.clear();
    inflightAuthQueries.clear();
    userAuthGeneration.clear();
    globalForAuthCache.__globalAuthGeneration =
      (globalForAuthCache.__globalAuthGeneration ?? 0) + 1;
  }
}

async function fetchUserAuthRecordFromDb(
  userId: string,
): Promise<UserAuthRecord | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT u.user_role, u.token_version, p.username
     FROM user_auth_tbl u
     LEFT JOIN player_tbl p ON u.user_id = p.user_id
     WHERE u.user_id = ? LIMIT 1`,
    [userId],
  );

  if (!Array.isArray(rows)) {
    return {
      user_role: "user",
      token_version: 1,
      isMockNonArray: true,
    };
  }

  if (rows.length === 0) {
    return null;
  }

  return {
    user_role: (rows[0]?.user_role as string) || "user",
    token_version: Number(rows[0]?.token_version ?? 1),
    username: (rows[0]?.username as string) || undefined,
  };
}

export const getCachedUserAuthRecord = cache(
  async (userId: string): Promise<UserAuthRecord | null> => {
    const idKey = String(userId);
    const now = Date.now();
    const cached = userAuthMemoryCache.get(idKey);
    if (cached) {
      if (cached.expiresAt > now) {
        return cached.record;
      }
      userAuthMemoryCache.delete(idKey);
    }

    const inflight = inflightAuthQueries.get(idKey);
    if (inflight) {
      return inflight;
    }

    const initialGlobalGen = globalForAuthCache.__globalAuthGeneration ?? 0;
    const initialUserGen = userAuthGeneration.get(idKey) ?? 0;

    const queryPromise = (async () => {
      try {
        const record = await fetchUserAuthRecordFromDb(idKey);
        const currentGlobalGen = globalForAuthCache.__globalAuthGeneration ?? 0;
        const currentUserGen = userAuthGeneration.get(idKey) ?? 0;
        if (
          currentGlobalGen === initialGlobalGen &&
          currentUserGen === initialUserGen
        ) {
          if (userAuthMemoryCache.size >= MAX_AUTH_CACHE_SIZE) {
            pruneExpiredCacheEntries(Date.now());
          }
          userAuthMemoryCache.set(idKey, {
            record,
            expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
          });
        }
        return record;
      } finally {
        inflightAuthQueries.delete(idKey);
      }
    })();

    inflightAuthQueries.set(idKey, queryPromise);
    return queryPromise;
  },
);
