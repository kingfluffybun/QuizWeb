import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Interactive Quizzes",
    description: "Test your HTML, CSS, and JavaScript knowledge with bite-sized interactive quizzes and live coding challenges.",
    openGraph: {
        title: "Interactive Web Development Quizzes | QuizWeb",
        description: "Test your HTML, CSS, and JavaScript knowledge with bite-sized interactive quizzes and live coding challenges.",
    },
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
