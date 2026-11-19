/**
 * Application Timezone Utilities
 *
 * Centralizes date formatting and timezone conversions to ensure user
 * activities, daily goals, streaks, and quiz completions align with local time.
 * Default timezone: Asia/Manila (UTC+8).
 */

export const DEFAULT_APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Manila";

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(timeZone: string): Intl.DateTimeFormat {
    let formatter = dateFormatterCache.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
        dateFormatterCache.set(timeZone, formatter);
    }
    return formatter;
}

/**
 * Returns the current (or supplied) date formatted as 'YYYY-MM-DD'
 * in the application's target timezone (default: Asia/Manila).
 */
export function getAppLocalDate(
    date: Date = new Date(),
    timeZone: string = DEFAULT_APP_TIMEZONE,
): string {
    return getDateFormatter(timeZone).format(date);
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
 * Returns the 7 Sunday-to-Saturday 'YYYY-MM-DD' date strings containing `asOfDate`.
 */
export function getSundayWeekDates(asOfDate: string): string[] {
    const anchor = new Date(`${asOfDate}T00:00:00Z`);
    const dayOfWeek = anchor.getUTCDay(); // 0 = Sunday .. 6 = Saturday
    const sunday = new Date(anchor);
    sunday.setUTCDate(anchor.getUTCDate() - dayOfWeek);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setUTCDate(sunday.getUTCDate() + i);
        dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
}

/**
 * Returns the Sunday 'YYYY-MM-DD' start date of the week containing `asOfDate`.
 */
export function getSundayWeekStart(asOfDate: string): string {
    const anchor = new Date(`${asOfDate}T00:00:00Z`);
    anchor.setUTCDate(anchor.getUTCDate() - anchor.getUTCDay());
    return anchor.toISOString().slice(0, 10);
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

    document.addEventListener("visibilitychange", handleEvent);
    window.addEventListener("focus", handleEvent);

    return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleEvent);
        window.removeEventListener("focus", handleEvent);
    };
};

export const getServerLocalDate = () => null;
