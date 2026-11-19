import { revalidateTag, unstable_cache, updateTag } from "next/cache";

export function createSafeCache<Args extends unknown[], Return>(
  fn: (...args: Args) => Promise<Return>,
  parts: string[],
  options?: { tags?: string[]; revalidate?: number | false },
): (...args: Args) => Promise<Return> {
  try {
    const cached = unstable_cache(fn, parts, options);
    return async (...args: Args) => {
      try {
        return await cached(...args);
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message || "";
        if (msg.includes("incrementalCache missing")) {
          return await fn(...args);
        }
        throw err;
      }
    };
  } catch {
    return fn;
  }
}

export function invalidateCacheTag(tag: string): void {
  try {
    updateTag(tag);
  } catch {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Silently ignore outside Next.js request/action context (e.g., CLI test scripts)
    }
  }
}
