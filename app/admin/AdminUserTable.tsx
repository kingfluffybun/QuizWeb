"use client";

import React, { useState } from "react";
import type { AdminUserRecord } from "@/app/actions/admin";

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

  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    onFilterChange(val, roleFilter, passwordFilter);
  };

  const handleRoleChange = (val: string) => {
    setRoleFilter(val);
    onFilterChange(searchQuery, val, passwordFilter);
  };

  const handlePasswordChange = (val: string) => {
    setPasswordFilter(val);
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
              users.map((user) => {
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
    </div>
  );
}
