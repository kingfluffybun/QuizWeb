/**
 * Application Timezone Utilities
 *
 * Centralizes date formatting and timezone conversions to ensure user
 * activities, daily goals, streaks, and quiz completions align with local time.
 * Default timezone: Asia/Manila (UTC+8).
 */

export const DEFAULT_APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Manila";

/**
 * Returns the current (or supplied) date formatted as 'YYYY-MM-DD'
 * in the application's target timezone (default: Asia/Manila).
 */
export function getAppLocalDate(
    date: Date = new Date(),
    timeZone: string = DEFAULT_APP_TIMEZONE,
): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

/**
 * Offsets a 'YYYY-MM-DD' date string by a number of days in UTC.
 */
export function getAdjacentDate(dateStr: string, dayOffset: number): string {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dayOffset);
    return d.toISOString().slice(0, 10);
}

/**
 * Returns the client-side local date formatted as 'YYYY-MM-DD'.
 * Safe for use in browser client components.
 */
export function getClientLocalDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Subscribes to client date changes (minute tick, tab focus, visibility change)
 * for use with React's useSyncExternalStore.
 */
export const subscribeClientDate = (onStoreChange: () => void) => {
    if (typeof window === "undefined") {
        return () => {};
    }
    const interval = setInterval(onStoreChange, 60000);
    const handleEvent = () => onStoreChange();

    window.addEventListener("visibilitychange", handleEvent);
    window.addEventListener("focus", handleEvent);

    return () => {
        clearInterval(interval);
        window.removeEventListener("visibilitychange", handleEvent);
        window.removeEventListener("focus", handleEvent);
    };
};

export const getServerLocalDate = () => null;
