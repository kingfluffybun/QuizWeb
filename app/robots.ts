import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://quizweb.dev";

    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/quiz", "/about", "/leaderboard", "/login"],
                disallow: ["/api/", "/input", "/pending", "/dashboard"],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
