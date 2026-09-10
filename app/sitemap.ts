import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quizweb.dev";
    const now = new Date();

    return [
        {
            url: `${baseUrl}`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 1.0,
        },
        {
            url: `${baseUrl}/quiz`,
            lastModified: now,
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/leaderboard`,
            lastModified: now,
            changeFrequency: "hourly",
            priority: 0.8,
        },
        {
            url: `${baseUrl}/about`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${baseUrl}/login`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.5,
        },
    ];
}
