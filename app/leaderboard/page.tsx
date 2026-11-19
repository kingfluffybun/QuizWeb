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

    const entriesByPeriod = await getLeaderboardEntriesByPeriod({ includeAll: true });
    const role = session.user.role || session.user.user_role || "user";
    const username = session.user.name || session.user.email?.split("@")[0] || "User";

    return (
        <div className="dashboard-page leaderboard-page">
            <Sidebar
                role={role}
                username={username}
                email={session.user.email ?? undefined}
            />
            <main>
                <div className="leaderboard-page-content">
                    <Leaderboard
                        entriesByPeriod={entriesByPeriod}
                        showPeriodTitle
                        initialPeriod="all-time"
                        currentUserId={session.user.id}
                    />
                </div>
            </main>
        </div>
    );
}
