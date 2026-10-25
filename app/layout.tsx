import type { Metadata } from "next";
import Script from "next/script";
import { JetBrains_Mono, Montserrat, Poppins } from "next/font/google";
import "./globals.css";
import "@/public/css/settings.css";
import "@/public/css/skeleton.css";
import AccessibilityInit from "@/app/components/AccessibilityInit";
import MobileShell from "@/app/components/MobileShell";
import "@/public/css/mobile-shell.css";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";

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
    title: "Quiz Web",
};

const themeInitScript = `
(function() {
    try {
        var saved = localStorage.getItem('app-accessibility-settings');
        var theme = 'system';
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

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
            </head>
            <body className={`${poppins.variable} ${montserrat.variable} ${jetBrainsMono.variable}`} suppressHydrationWarning>
                <SessionProvider session={session}>
                <AccessibilityInit />
                <MobileShell>{children}</MobileShell>
                <Script id="theme-init" strategy="beforeInteractive">
                    {themeInitScript}
                </Script>
                </SessionProvider>
            </body>
        </html>
    )
}
