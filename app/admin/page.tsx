import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac";
import {
  getAdminUsers,
  getAdminAnalytics,
  getAdminReviewQueue,
} from "@/app/actions/admin";
import Sidebar from "@/app/components/Sidebar";
import AdminDashboardClient from "./AdminDashboardClient";
import "#css/sidebar.css";
import "#css/nav.css";
import "#css/admin.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // 1. Authoritative Server-side Defense-in-Depth Authentication
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/home");
  }

  // 2. Parallel Data Loading with Graceful Fallbacks
  let initialUsers: Awaited<ReturnType<typeof getAdminUsers>>["users"] = [];
  let initialAnalytics: Awaited<ReturnType<typeof getAdminAnalytics>> = {
    totalQuizzes: 0,
    categories: [],
    difficulties: [],
    contributors: [],
  };
  let initialReviewQueue: Awaited<ReturnType<typeof getAdminReviewQueue>> = [];

  try {
    const [usersResult, analyticsResult, queueResult] = await Promise.all([
      getAdminUsers(),
      getAdminAnalytics(),
      getAdminReviewQueue(),
    ]);
    initialUsers = usersResult.users;
    initialAnalytics = analyticsResult;
    initialReviewQueue = queueResult;
  } catch (err) {
    console.error("Failed to load initial admin dashboard data:", err);
  }

  return (
    <div className="admin-app-layout">
      <Sidebar role="admin" username={admin.email || "Admin"} />
      <main className="admin-main">
        <div className="admin-container">
          <header className="admin-header">
            <div>
              <div className="admin-header-title-row">
                <h1 className="admin-header-title">Admin Dashboard</h1>
                <span className="admin-header-badge">Privileged Staff Area</span>
              </div>
              <p className="admin-header-subtitle">
                Manage system users, review community quiz submissions, and monitor platform curriculum analytics.
              </p>
            </div>
          </header>

          <AdminDashboardClient
            currentAdminId={Number(admin.id)}
            currentAdminEmail={admin.email || ""}
            initialUsers={initialUsers}
            initialAnalytics={initialAnalytics}
            initialReviewQueue={initialReviewQueue}
          />
        </div>
      </main>
    </div>
  );
}
