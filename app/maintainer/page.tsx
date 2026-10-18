import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireStaff } from "@/lib/rbac";
import Sidebar from "@/app/components/Sidebar";
import MaintainerStudioClient from "./MaintainerStudioClient";
import type { MaintainerSubmission, MaintainerStats, MaintainerUserProfile } from "./MaintainerStudioClient";
import "#css/sidebar.css";
import "#css/dashboard.css";
import "#css/maintainer.css";

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

  try {
    const { getMaintainerStats, getMaintainerSubmissions } = await import(
      "@/app/actions/maintainer"
    );

    const [statsResult, subsResult] = await Promise.allSettled([
      getMaintainerStats(),
      getMaintainerSubmissions(),
    ]);

    if (statsResult.status === "fulfilled") {
      initialStats = statsResult.value;
    }

    if (subsResult.status === "fulfilled") {
      initialSubmissions = subsResult.value.submissions;
    }
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
    <div className="dashboard-page maintainer-studio-page">
      <Sidebar
        role={staff.role}
        username={currentUserProfile.name}
      />
      <main className="maintainer-main">
        <MaintainerStudioClient
          initialStats={initialStats}
          initialSubmissions={initialSubmissions}
          currentUser={currentUserProfile}
        />
      </main>
    </div>
  );
}
