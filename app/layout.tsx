import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { JetBrains_Mono, Montserrat, Poppins } from "next/font/google";
import "./globals.css";
import "@/public/css/accessibility-dialog.css";
import "@/public/css/skeleton.css";
import "@/public/css/mobile-shell.css";
import "@/public/css/tutorial-overlay.css";
import MobileShell from "@/app/components/MobileShell";
import SessionWrapper from "@/app/components/SessionWrapper";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ['400', '500', '600', '700', '800'],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ['400', '500', '600', '700', '800'],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ['400', '500', '600', '700'],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quiz Web",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      if (parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system') {
        theme = parsed.theme;
      }
      if (parsed.reduceMotion !== undefined) reduceMotion = Boolean(parsed.reduceMotion);
      if (parsed.uiScale) uiScale = Number(parsed.uiScale);
    }
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-motion', reduceMotion ? 'reduce' : 'normal');
    root.removeAttribute('data-contrast');
    if (uiScale && !isNaN(uiScale)) {
      root.style.setProperty('--base-scale', uiScale + '%');
      root.style.setProperty('--settings-base-scale', uiScale + '%');
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${montserrat.variable} ${jetBrainsMono.variable}`}
        suppressHydrationWarning
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <SessionWrapper>
          <MobileShell>{children}</MobileShell>
        </SessionWrapper>
      </body>
    </html>
  );
}
