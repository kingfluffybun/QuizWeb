import { auth } from "@/auth";
import { redirect } from "next/navigation";
import "#css/dashboard.css";
import { getLearnerProfile, getCurriculumMap, getLeaderboard } from "@/app/actions/player";
import DashboardClient from "./DashboardClient";

export const metadata = {
    title: "Learning Path & Dashboard | QuizWeb",
    description: "Track your learning progress, maintain your daily streak, and master web development.",
};

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const userId = Number(session.user.id);
    const isAdmin = session.user.role === "admin";

    // Fetch learner data in parallel
    const [profile, curriculum, leaderboard] = await Promise.all([
        getLearnerProfile(),
        getCurriculumMap("HTML"),
        getLeaderboard(),
    ]);

    const fallbackProfile = {
        userId,
        username: session.user.name || "Learner",
        xp: 0,
        level: 1,
        xpForCurrentLevel: 0,
        xpForNextLevel: 100,
        levelProgressPercent: 0,
        currentStreak: 0,
        maxStreak: 0,
        lastQuizDate: null,
        hearts: 5,
        gems: 50,
        currentSection: 1,
        completedNodes: {},
    };

    return (
        <DashboardClient
            initialProfile={profile || fallbackProfile}
            initialCurriculum={curriculum}
            leaderboard={leaderboard}
            isAdmin={isAdmin}
        />
    );
}