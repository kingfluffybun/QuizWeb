import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireStaff } from "@/lib/rbac";
import {
  getPaginatedRecentQuizzes,
  getPendingQuizzes,
  getQuizMetadata,
  getQuizMetrics,
} from "@/app/actions/quiz";
import Sidebar from "@/app/components/Sidebar";
import StaffWorkspaceTools from "@/app/components/StaffWorkspaceTools";
import MaintainerStudioClient from "./MaintainerStudioClient";
import type { MaintainerSubmission, MaintainerStats, MaintainerUserProfile } from "./MaintainerStudioClient";
import "#css/sidebar.css";
import "#css/dashboard.css";
import "#css/maintainer.css";
import "#css/input.css";
import "#css/pending.css";

// Force dynamic execution for live review status freshness
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maintainer Studio | QuizWeb",
  description: "Author questions, interactive coding steps, and track curriculum unit submissions.",
};

export default async function MaintainerStudioPage() {
  // 1. Enforce strict server-side staff authorization (Admin or Maintainer)
  const staff = await requireStaff();
  const session = await auth();

  if (!staff || !session?.user) {
    if (!session?.user) {
      redirect("/login?callbackUrl=/maintainer");
    }
    // Authenticated standard user attempting unauthorized staff access
    redirect("/home");
  }

  // 2. Initial Data Loading from Maintainer Actions
  let initialStats: MaintainerStats = { approved: 0, pending: 0, rejected: 0, total: 0 };
  let initialSubmissions: MaintainerSubmission[] = [];
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
    const { getMaintainerStats, getMaintainerSubmissions } = await import(
      "@/app/actions/maintainer"
    );

    const [statsResult, subsResult, metadataResult, recentResult, metricsResult, pendingResult] = await Promise.allSettled([
      getMaintainerStats(),
      getMaintainerSubmissions(),
      getQuizMetadata(),
      getPaginatedRecentQuizzes(),
      getQuizMetrics(),
      getPendingQuizzes("pending"),
    ]);

    if (statsResult.status === "fulfilled") {
      initialStats = statsResult.value;
    }

    if (subsResult.status === "fulfilled") {
      initialSubmissions = subsResult.value.submissions;
    }
    if (metadataResult.status === "fulfilled") workspaceMetadata = metadataResult.value;
    if (recentResult.status === "fulfilled") workspaceRecent = recentResult.value;
    if (metricsResult.status === "fulfilled") workspaceMetrics = metricsResult.value;
    if (pendingResult.status === "fulfilled") workspacePending = pendingResult.value;
  } catch (error) {
    console.error("[MaintainerStudioPage] Failed to load maintainer data:", error);
    // Graceful fallback: renders client studio with empty state rather than 500 error
  }

  const currentUserProfile: MaintainerUserProfile = {
    id: String(staff.id),
    name: session.user.name || session.user.email?.split("@")[0] || `maintainer_${staff.id}`,
    email: session.user.email || "",
    role: staff.role,
  };

  return (
    <div className="dashboard-page maintainer-page maintainer-studio-page">
      <Sidebar/>
      <main className="maintainer-main">
        <MaintainerStudioClient
          initialStats={initialStats}
          initialSubmissions={initialSubmissions}
          currentUser={currentUserProfile}
        >
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
            canReview={staff.role === "admin"}
          />
        </MaintainerStudioClient>
      </main>
    </div>
  );
}
