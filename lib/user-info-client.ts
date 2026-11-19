import type { UserInfoResponse } from "@/app/api/db/user-info/route";

export type UserInfoFetchMode = "minimal" | "full";

const CACHE_TTL_MS = 30_000;

let cachedFull: { data: UserInfoResponse; fetchedAt: number } | null = null;
let cachedMinimal: { data: UserInfoResponse; fetchedAt: number } | null = null;
let inflightFull: Promise<UserInfoResponse | null> | null = null;
let inflightMinimal: Promise<UserInfoResponse | null> | null = null;

function isFresh(entry: { fetchedAt: number } | null): boolean {
  return Boolean(entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS);
}

/**
 * Fetches `/api/db/user-info` with in-flight deduplication and a short TTL cache.
 * A `"full"` response satisfies subsequent `"minimal"` callers (e.g. Sidebar + Profile).
 */
export async function fetchClientUserInfo(
  mode: UserInfoFetchMode = "full",
  forceRefresh = false,
): Promise<UserInfoResponse | null> {
  if (!forceRefresh) {
    if (isFresh(cachedFull) && cachedFull) {
      return cachedFull.data;
    }
    if (mode === "minimal" && isFresh(cachedMinimal) && cachedMinimal) {
      return cachedMinimal.data;
    }
  }

  // Prefer coalescing onto an already-active full fetch even if caller asked for minimal
  if (inflightFull) {
    return inflightFull;
  }
  if (mode === "minimal" && inflightMinimal) {
    return inflightMinimal;
  }

  const endpoint =
    mode === "minimal" ? "/api/db/user-info?minimal=1" : "/api/db/user-info";

  const promise = (async () => {
    try {
      const res = await fetch(endpoint, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as UserInfoResponse;
      if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
        return null;
      }
      const now = Date.now();
      if (mode === "full") {
        cachedFull = { data, fetchedAt: now };
        cachedMinimal = { data, fetchedAt: now };
      } else {
        cachedMinimal = { data, fetchedAt: now };
      }
      return data;
    } catch {
      return null;
    } finally {
      if (mode === "full") {
        inflightFull = null;
      } else {
        inflightMinimal = null;
      }
    }
  })();

  if (mode === "full") {
    inflightFull = promise;
  } else {
    inflightMinimal = promise;
  }

  return promise;
}

export function patchClientUserInfoCache(patch: Partial<UserInfoResponse>): void {
  const now = Date.now();
  if (cachedFull) {
    cachedFull = { data: { ...cachedFull.data, ...patch }, fetchedAt: now };
  }
  if (cachedMinimal) {
    cachedMinimal = { data: { ...cachedMinimal.data, ...patch }, fetchedAt: now };
  }
}

export function invalidateClientUserInfoCache(): void {
  cachedFull = null;
  cachedMinimal = null;
  inflightFull = null;
  inflightMinimal = null;
}
