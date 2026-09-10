import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign In or Sign Up",
    description: "Log in or create your QuizWeb account to track your quiz progress, earn daily streaks, and master web development.",
    openGraph: {
        title: "Sign In / Sign Up | QuizWeb",
        description: "Log in or create your QuizWeb account to track your quiz progress, earn daily streaks, and master web development.",
    },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
