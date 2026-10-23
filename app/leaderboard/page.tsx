import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import Leaderboard from "@/app/components/Leaderboard";
import { getLeaderboardEntriesByPeriod } from "@/app/actions/leaderboard";
import "#css/dashboard.css";
import "#css/sidebar.css";
import "#css/leaderboard.css";

export default async function LeaderboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const entriesByPeriod = await getLeaderboardEntriesByPeriod();

    return (
        <div className="dashboard-page leaderboard-page">
            <Sidebar />
            <main>
                <div className="leaderboard-page-content">
                    <Leaderboard
                        entriesByPeriod={entriesByPeriod}
                        showPeriodTitle
                        initialPeriod="all-time"
                    />
                </div>
            </main>
        </div>
    );
}
