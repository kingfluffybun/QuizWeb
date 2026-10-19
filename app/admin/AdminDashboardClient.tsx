"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  type AdminUserRecord,
  type PlatformAnalytics,
  type PendingReviewItem,
  getAdminUsers,
  getAdminAnalytics,
  getAdminReviewQueue,
  promoteUser,
  demoteUser,
  reviewPendingQuiz,
} from "@/app/actions/admin";

import AdminStatsCards from "./AdminStatsCards";
import AdminUserTable from "./AdminUserTable";
import AdminReviewQueue from "./AdminReviewQueue";
import AdminAnalyticsView from "./AdminAnalyticsView";
import AdminSecretKeyModal from "./AdminSecretKeyModal";
import RejectionNotesModal from "./RejectionNotesModal";

export interface AdminDashboardClientProps {
  currentAdminId: number;
  currentAdminEmail: string;
  initialUsers: AdminUserRecord[];
  initialAnalytics: PlatformAnalytics;
  initialReviewQueue: PendingReviewItem[];
}

export type AdminTab = "users" | "queue" | "analytics";

export interface AdminAlert {
  type: "success" | "error" | "info";
  message: string;
}

export default function AdminDashboardClient({
  currentAdminId,
  currentAdminEmail,
  initialUsers,
  initialAnalytics,
  initialReviewQueue,
}: AdminDashboardClientProps) {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [alert, setAlert] = useState<AdminAlert | null>(null);
  const [isPending, startTransition] = useTransition();

  // Data Stores
  const [users, setUsers] = useState<AdminUserRecord[]>(initialUsers);
  const [analytics, setAnalytics] = useState<PlatformAnalytics>(initialAnalytics);
  const [reviewQueue, setReviewQueue] = useState<PendingReviewItem[]>(initialReviewQueue);

  // Modals State
  const [secretModalUser, setSecretModalUser] = useState<AdminUserRecord | null>(null);
  const [rejectModalItem, setRejectModalItem] = useState<PendingReviewItem | null>(null);

  // Refresh Helpers
  const refreshUsers = async (query?: string, roleFilter?: string, pwdFilter?: string) => {
    try {
      const res = await getAdminUsers(query, roleFilter, pwdFilter);
      setUsers(res.users);
    } catch (err: unknown) {
      console.error("Failed to refresh users:", err);
    }
  };

  const refreshQueueAndAnalytics = async () => {
    try {
      const [queueRes, analyticsRes] = await Promise.all([
        getAdminReviewQueue(),
        getAdminAnalytics(),
      ]);
      setReviewQueue(queueRes);
      setAnalytics(analyticsRes);
    } catch (err: unknown) {
      console.error("Failed to refresh queue and analytics:", err);
    }
  };

  // Synchronize with external pending events
  useEffect(() => {
    const handleQueueUpdated = () => {
      startTransition(async () => {
        await refreshQueueAndAnalytics();
      });
    };
    window.addEventListener("quizweb-pending-updated", handleQueueUpdated);
    return () => window.removeEventListener("quizweb-pending-updated", handleQueueUpdated);
  }, []);

  // Action Handler: Promote to Maintainer
  const handlePromoteToMaintainer = async (targetUser: AdminUserRecord) => {
    if (!targetUser.has_password) {
      setAlert({
        type: "error",
        message: "Password Required: Target user must establish an account password before promotion.",
      });
      return;
    }

    startTransition(async () => {
      const res = await promoteUser(targetUser.user_id, "maintainer");
      if (res.success) {
        setAlert({
          type: "success",
          message: `Successfully promoted ${targetUser.username} to Maintainer.`,
        });
        await refreshUsers();
      } else {
        setAlert({
          type: "error",
          message: res.error || "Failed to promote user.",
        });
      }
    });
  };

  // Action Handler: Demote / Revoke Maintainer
  const handleDemoteUser = async (targetUser: AdminUserRecord) => {
    if (targetUser.user_id === currentAdminId) {
      setAlert({
        type: "error",
        message: "Self-demotion blocked: You cannot demote yourself from Admin.",
      });
      return;
    }

    const confirmMsg =
      targetUser.user_role === "admin"
        ? `Are you sure you want to demote Administrator ${targetUser.username} to standard User?`
        : `Revoke Maintainer privileges for ${targetUser.username}?`;

    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      const res = await demoteUser(targetUser.user_id);
      if (res.success) {
        setAlert({
          type: "success",
          message: `Successfully transitioned ${targetUser.username} to standard User.`,
        });
        await refreshUsers();
      } else {
        setAlert({
          type: "error",
          message: res.error || "Failed to demote user.",
        });
      }
    });
  };

  // Action Handler: Approve Submission
  const handleApproveSubmission = async (pendingId: number) => {
    startTransition(async () => {
      const res = await reviewPendingQuiz(pendingId, "approve", `Approved by Admin ${currentAdminEmail}`);
      if (res.success) {
        setAlert({
          type: "success",
          message: res.message || "Unit approved and added to active curriculum.",
        });
        await refreshQueueAndAnalytics();
        window.dispatchEvent(new Event("quizweb-pending-updated"));
      } else {
        setAlert({
          type: "error",
          message: res.error || "Failed to approve unit.",
        });
      }
    });
  };

  // Action Handler: Rejection Note Submission (from Modal)
  const handleRejectSubmission = async (pendingId: number, rejectionNotes: string): Promise<boolean> => {
    const res = await reviewPendingQuiz(pendingId, "reject", rejectionNotes);
    if (res.success) {
      setAlert({
        type: "success",
        message: res.message || "Unit rejected with feedback notes.",
      });
      await refreshQueueAndAnalytics();
      window.dispatchEvent(new Event("quizweb-pending-updated"));
      return true;
    } else {
      setAlert({
        type: "error",
        message: res.error || "Failed to reject unit.",
      });
      return false;
    }
  };

  return (
    <div className="admin-dashboard-container">
      {/* 1. Global Alert Banner */}
      {alert && (
        <div className={`admin-alert admin-alert-${alert.type}`} role="alert">
          <div className="admin-alert-content">
            <span className="admin-alert-text">{alert.message}</span>
            <button
              type="button"
              className="admin-alert-dismiss"
              onClick={() => setAlert(null)}
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. Top-Level Metric Summary Cards */}
      <AdminStatsCards
        totalQuizzes={analytics.totalQuizzes}
        pendingCount={reviewQueue.length}
        totalUsers={users.length}
        totalContributors={analytics.contributors.length}
      />

      {/* 3. Interactive Tab Navigation */}
      <nav className="admin-tabs" role="tablist" aria-label="Admin Dashboard Sections">
        <button
          type="button"
          role="tab"
          id="tab-users"
          aria-selected={activeTab === "users"}
          aria-controls="panel-users"
          className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          <span>Users &amp; Roles</span>
          <span className="admin-tab-badge">{users.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-queue"
          aria-selected={activeTab === "queue"}
          aria-controls="panel-queue"
          className={`admin-tab-btn ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
        >
          <span>Review Queue</span>
          {reviewQueue.length > 0 && (
            <span className="admin-tab-badge admin-tab-badge-highlight">{reviewQueue.length}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-analytics"
          aria-selected={activeTab === "analytics"}
          aria-controls="panel-analytics"
          className={`admin-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          <span>Platform Analytics</span>
        </button>
      </nav>

      {/* 4. Tab Panels */}
      <div className="admin-tab-content">
        {activeTab === "users" && (
          <div id="panel-users" role="tabpanel" aria-labelledby="tab-users">
            <AdminUserTable
              users={users}
              currentAdminId={currentAdminId}
              isPending={isPending}
              onPromoteMaintainer={handlePromoteToMaintainer}
              onDemoteUser={handleDemoteUser}
              onOpenSecretModal={(target) => setSecretModalUser(target)}
              onFilterChange={(q, role, pwd) => {
                startTransition(async () => {
                  await refreshUsers(q, role, pwd);
                });
              }}
            />
          </div>
        )}

        {activeTab === "queue" && (
          <div id="panel-queue" role="tabpanel" aria-labelledby="tab-queue">
            <AdminReviewQueue
              queue={reviewQueue}
              isPending={isPending}
              onApprove={handleApproveSubmission}
              onOpenRejectModal={(item) => setRejectModalItem(item)}
            />
          </div>
        )}

        {activeTab === "analytics" && (
          <div id="panel-analytics" role="tabpanel" aria-labelledby="tab-analytics">
            <AdminAnalyticsView
              analytics={analytics}
              pendingCount={reviewQueue.length}
              userCount={users.length}
            />
          </div>
        )}
      </div>

      {/* 5. Modals */}
      <AdminSecretKeyModal
        isOpen={Boolean(secretModalUser)}
        targetUser={secretModalUser}
        onClose={() => setSecretModalUser(null)}
        onSuccess={async () => {
          setAlert({
            type: "success",
            message: `Successfully elevated ${secretModalUser?.username} to Administrator.`,
          });
          setSecretModalUser(null);
          await refreshUsers();
        }}
      />

      <RejectionNotesModal
        isOpen={Boolean(rejectModalItem)}
        targetItem={rejectModalItem}
        onClose={() => setRejectModalItem(null)}
        onSubmit={handleRejectSubmission}
      />
    </div>
  );
}
