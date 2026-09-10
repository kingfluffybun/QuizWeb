import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "About Us",
    description: "Learn about QuizWeb, our interactive learning methodology, and the team empowering aspiring web developers worldwide.",
    openGraph: {
        title: "About QuizWeb — Interactive Web Development Learning",
        description: "Learn about QuizWeb, our interactive learning methodology, and the team empowering aspiring web developers worldwide.",
    },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
