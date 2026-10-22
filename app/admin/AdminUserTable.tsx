"use client";

import React, { useState } from "react";
import type { AdminUserRecord } from "@/app/actions/admin";

const USERS_PER_PAGE = 6;

export interface AdminUserTableProps {
  users: AdminUserRecord[];
  currentAdminId: number;
  isPending: boolean;
  onPromoteMaintainer: (user: AdminUserRecord) => Promise<void>;
  onDemoteUser: (user: AdminUserRecord) => Promise<void>;
  onOpenSecretModal: (user: AdminUserRecord) => void;
  onFilterChange: (query: string, roleFilter: string, passwordFilter: string) => void;
}

export default function AdminUserTable({
  users,
  currentAdminId,
  isPending,
  onPromoteMaintainer,
  onDemoteUser,
  onOpenSecretModal,
  onFilterChange,
}: AdminUserTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [passwordFilter, setPasswordFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  const visiblePage = Math.min(currentPage, totalPages);
  const visibleUsers = users.slice(
    (visiblePage - 1) * USERS_PER_PAGE,
    visiblePage * USERS_PER_PAGE,
  );
  const firstVisibleUser = users.length === 0 ? 0 : (visiblePage - 1) * USERS_PER_PAGE + 1;
  const lastVisibleUser = Math.min(visiblePage * USERS_PER_PAGE, users.length);

  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
    onFilterChange(val, roleFilter, passwordFilter);
  };

  const handleRoleChange = (val: string) => {
    setRoleFilter(val);
    setCurrentPage(1);
    onFilterChange(searchQuery, val, passwordFilter);
  };

  const handlePasswordChange = (val: string) => {
    setPasswordFilter(val);
    setCurrentPage(1);
    onFilterChange(searchQuery, roleFilter, val);
  };

  return (
    <div className="admin-user-management">
      {/* Search & Filtering Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-search-wrapper">
          <svg className="admin-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            aria-label="Search users"
          />
        </div>

        <div className="admin-filters-wrapper">
          <div className="admin-filter-field">
            <label htmlFor="filter-role" className="admin-filter-label">Role:</label>
            <select
              id="filter-role"
              className="admin-select"
              value={roleFilter}
              onChange={(e) => handleRoleChange(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="maintainer">Maintainer</option>
              <option value="user">User</option>
            </select>
          </div>

          <div className="admin-filter-field">
            <label htmlFor="filter-password" className="admin-filter-label">Auth Status:</label>
            <select
              id="filter-password"
              className="admin-select"
              value={passwordFilter}
              onChange={(e) => handlePasswordChange(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Password Set">Password Set</option>
              <option value="OAuth-Only">OAuth-Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="admin-table-wrapper">
        <table className="admin-table" aria-label="System Users and Roles">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Role</th>
              <th scope="col">Password Status</th>
              <th scope="col">Email Verified</th>
              <th scope="col" className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-table-empty">
                  No users match the search and filter criteria.
                </td>
              </tr>
            ) : (
              visibleUsers.map((user) => {
                const isSelf = user.user_id === currentAdminId;
                const isOAuthWithoutPass = !user.has_password;
                const isAdmin = user.user_role === "admin";
                const isMaintainer = user.user_role === "maintainer";

                return (
                  <tr key={user.user_id} className={isSelf ? "admin-tr-self" : ""}>
                    <td className="admin-user-cell">
                      <div className="admin-user-avatar">
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="admin-user-meta">
                        <div className="admin-user-name">
                          {user.username}
                          {isSelf && <span className="admin-self-pill">You</span>}
                        </div>
                        <div className="admin-user-email">{user.email}</div>
                      </div>
                    </td>

                    <td>
                      <span className={`admin-badge admin-badge-${user.user_role}`}>
                        {user.user_role === "admin"
                          ? "Admin"
                          : user.user_role === "maintainer"
                          ? "Maintainer"
                          : "User"}
                      </span>
                    </td>

                    <td>
                      {user.has_password ? (
                        <span className="admin-badge admin-badge-pwd-set">Password Set</span>
                      ) : (
                        <span
                          className="admin-badge admin-badge-oauth"
                          title="Account authenticated via OAuth without local password"
                        >
                          OAuth-Only
                        </span>
                      )}
                    </td>

                    <td>
                      <span className={`admin-status-dot ${user.is_email_verified ? "verified" : "unverified"}`}>
                        {user.is_email_verified ? "Verified" : "Unverified"}
                      </span>
                    </td>

                    <td className="admin-actions-cell text-right">
                      <div className="admin-actions-group">
                        {/* 1. Promote to Maintainer */}
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-secondary"
                          onClick={() => onPromoteMaintainer(user)}
                          disabled={isPending || isOAuthWithoutPass || isMaintainer || isAdmin}
                          title={
                            isOAuthWithoutPass
                              ? "Password Required: Target user has not established a password and cannot be granted staff access."
                              : isMaintainer || isAdmin
                              ? "User already has staff privileges."
                              : "Promote user to Maintainer role."
                          }
                        >
                          + Maintainer
                        </button>

                        {/* 2. Promote to Admin (Guarded by Secret Key) */}
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-primary"
                          onClick={() => onOpenSecretModal(user)}
                          disabled={isPending || isOAuthWithoutPass || isAdmin}
                          title={
                            isOAuthWithoutPass
                              ? "Password Required: Target user has not established a password and cannot be granted staff access."
                              : isAdmin
                              ? "User is already an Administrator."
                              : "Promote user to Admin tier (Requires ADMIN_SECRET_KEY)."
                          }
                        >
                          + Admin
                        </button>

                        {/* 3. Demote / Revoke */}
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => onDemoteUser(user)}
                          disabled={isPending || isSelf || user.user_role === "user"}
                          title={
                            isSelf
                              ? "Cannot demote yourself"
                              : user.user_role === "user"
                              ? "User is already standard tier."
                              : "Demote user to standard User role."
                          }
                        >
                          Demote
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {users.length > USERS_PER_PAGE && (
        <nav className="admin-user-pagination" aria-label="User table pagination">
          <span className="admin-user-pagination-status" aria-live="polite">
            Showing {firstVisibleUser}–{lastVisibleUser} of {users.length} users
          </span>
          <div className="admin-user-pagination-controls">
            <button
              type="button"
              className="admin-btn admin-btn-sm admin-btn-secondary"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={visiblePage === 1}
            >
              Previous
            </button>
            <span className="admin-user-pagination-page">
              Page {visiblePage} of {totalPages}
            </span>
            <button
              type="button"
              className="admin-btn admin-btn-sm admin-btn-secondary"
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={visiblePage === totalPages}
            >
              Next
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
