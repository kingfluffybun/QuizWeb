import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/rbac";
import {
  getAdminUsers,
  getAdminAnalytics,
  getAdminReviewQueue,
} from "@/app/actions/admin";
import {
  getPaginatedRecentQuizzes,
  getPendingQuizzes,
  getQuizMetadata,
  getQuizMetrics,
} from "@/app/actions/quiz";
import Sidebar from "@/app/components/Sidebar";
import StaffWorkspaceTools from "@/app/components/StaffWorkspaceTools";
import AdminDashboardClient from "./AdminDashboardClient";
import "#css/sidebar.css";
import "#css/nav.css";
import "#css/input.css";
import "#css/pending.css";
import "#css/admin.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // 1. Authoritative Server-side Defense-in-Depth Authentication
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/home");
  }
  const session = await auth();

  // 2. Parallel Data Loading with Graceful Fallbacks
  let initialUsers: Awaited<ReturnType<typeof getAdminUsers>>["users"] = [];
  let initialAnalytics: Awaited<ReturnType<typeof getAdminAnalytics>> = {
    totalQuizzes: 0,
    categories: [],
    difficulties: [],
    contributors: [],
  };
  let initialReviewQueue: Awaited<ReturnType<typeof getAdminReviewQueue>> = [];
  let workspaceMetadata: Awaited<ReturnType<typeof getQuizMetadata>> = {
    categories: [],
    difficulties: [],
    types: [],
    sections: [],
  };
  let workspaceRecent: Awaited<ReturnType<typeof getPaginatedRecentQuizzes>> = {
    quizzes: [],
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
  };
  let workspaceMetrics: Awaited<ReturnType<typeof getQuizMetrics>> = {
    totalQuizzes: 0,
    byCategory: [],
    byType: [],
    byDifficulty: [],
    bySection: [],
    lowCoverageSections: [],
    matrix: [],
    facetedBreakdown: [],
  };
  let workspacePending: Awaited<ReturnType<typeof getPendingQuizzes>> = [];

  try {
    const [usersResult, analyticsResult, queueResult, metadata, recent, metrics, pending] = await Promise.all([
      getAdminUsers(),
      getAdminAnalytics(),
      getAdminReviewQueue(),
      getQuizMetadata(),
      getPaginatedRecentQuizzes(),
      getQuizMetrics(),
      getPendingQuizzes("all"),
    ]);
    initialUsers = usersResult.users;
    initialAnalytics = analyticsResult;
    initialReviewQueue = queueResult;
    workspaceMetadata = metadata;
    workspaceRecent = recent;
    workspaceMetrics = metrics;
    workspacePending = pending;
  } catch (err) {
    console.error("Failed to load initial admin dashboard data:", err);
  }

  return (
    <div className="dashboard-page admin-app-layout">
      <Sidebar/>
      <main className="admin-main">
        <div className="admin-container">
          <header className="admin-header admin-dashboard-header">
            <div className="admin-dashboard-header-content">
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
          <StaffWorkspaceTools
            categories={workspaceMetadata.categories}
            difficulties={workspaceMetadata.difficulties}
            types={workspaceMetadata.types}
            sections={workspaceMetadata.sections}
            recentQuizzes={workspaceRecent.quizzes}
            recentPage={workspaceRecent.currentPage}
            recentTotalPages={workspaceRecent.totalPages}
            recentTotalCount={workspaceRecent.totalCount}
            metrics={workspaceMetrics}
            pendingQuizzes={workspacePending}
            canReview
          />
        </div>
      </main>
    </div>
  );
}
