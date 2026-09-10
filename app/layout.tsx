import type { Metadata } from "next";
import { JetBrains_Mono, Montserrat, Poppins } from "next/font/google";
import "./globals.css";
import "@/public/css/settings.css";
import AccessibilityInit from "@/app/components/AccessibilityInit";

const poppins = Poppins({
    variable: "--font-poppins",
    subsets: ["latin"],
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

const montserrat = Montserrat({
    variable: "--font-montserrat",
    subsets: ["latin"],
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

const jetBrainsMono = JetBrains_Mono({
    variable: "--font-jetbrains-mono",
    subsets: ["latin"],
    weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://quizweb.dev"),
    title: {
        default: "QuizWeb — Master Web Development with Interactive Quizzes",
        template: "%s | QuizWeb",
    },
    description: "Interactive bite-sized quizzes for mastering HTML, CSS, and JavaScript. Practice coding challenges, track daily streaks, and learn web development faster.",
    keywords: ["quiz", "web development", "learn HTML", "learn CSS", "learn JavaScript", "interactive quizzes"],
    authors: [{ name: "QuizWeb Team" }],
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "/",
        siteName: "QuizWeb",
        title: "QuizWeb — Master Web Development with Interactive Quizzes",
        description: "Interactive bite-sized quizzes for mastering HTML, CSS, and JavaScript.",
        images: [
            {
                url: "/assets/QuizWeb-Logo.svg",
                width: 800,
                height: 600,
                alt: "QuizWeb Logo",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "QuizWeb — Master Web Development with Interactive Quizzes",
        description: "Interactive bite-sized quizzes for mastering HTML, CSS, and JavaScript.",
        images: ["/assets/QuizWeb-Logo.svg"],
    },
    alternates: {
        canonical: "/",
    },
};

const themeInitScript = `
(function() {
    try {
        var saved = localStorage.getItem('app-accessibility-settings');
        var theme = 'light';
        var reduceMotion = false;
        var uiScale = null;
        if (saved) {
            var parsed = JSON.parse(saved);
            if (parsed.theme) theme = parsed.theme;
            if (parsed.reduceMotion !== undefined) reduceMotion = parsed.reduceMotion;
            if (parsed.uiScale) uiScale = parsed.uiScale;
        }
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-motion', reduceMotion ? 'reduce' : 'normal');
        document.documentElement.removeAttribute('data-contrast');
        if (uiScale) {
            document.documentElement.style.setProperty('--base-scale', uiScale + '%');
            document.documentElement.style.setProperty('--settings-base-scale', uiScale + '%');
        }
    } catch (e) {}
})();
`;

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${poppins.variable} ${montserrat.variable} ${jetBrainsMono.variable}`} suppressHydrationWarning>
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body>
                <AccessibilityInit />
                {children}
            </body>
        </html>
    )
}
