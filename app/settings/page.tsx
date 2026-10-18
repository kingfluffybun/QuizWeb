import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import SettingsClient, { type SettingsUserData } from "./SettingsClient";
import Sidebar from "@/app/components/Sidebar";
import PublicNav from "@/app/components/publicNav";
import "#css/sidebar.css";
import "#css/nav.css";
import "@/public/css/settings.css";

export default async function SettingsPage() {
  const session = await auth();

  let initialUser: SettingsUserData | null = null;

  if (session?.user?.id) {
    const userId = session.user.id;
    const sessUser = session.user as Record<string, unknown>;
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT a.user_role, a.password_hash, p.username 
         FROM user_auth_tbl a 
         LEFT JOIN player_tbl p ON a.user_id = p.user_id 
         WHERE a.user_id = ? LIMIT 1`,
        [userId]
      );

      const role =
        (rows[0]?.user_role as string) ||
        (sessUser.role as string) ||
        (sessUser.user_role as string) ||
        "user";
      const hasPassword =
        rows[0]?.password_hash !== null &&
        rows[0]?.password_hash !== undefined &&
        rows[0]?.password_hash !== "";
      const username =
        (rows[0]?.username as string) || session.user.name || `player_${userId}`;

      initialUser = {
        id: String(userId),
        email: session.user.email || "",
        username,
        role,
        hasPassword,
      };
    } catch {
      // Offline / test harness fallback
      initialUser = {
        id: String(userId),
        email: session.user.email || "",
        username: session.user.name || `player_${userId}`,
        role: (sessUser.role as string) || (sessUser.user_role as string) || "user",
        hasPassword: false,
      };
    }
  }

  return (
    <div className={initialUser ? "settings-app-layout" : "settings-public-layout"}>
      {initialUser ? <Sidebar /> : <PublicNav />}
      <main className="settings-main">
        <SettingsClient initialUser={initialUser} />
      </main>
    </div>
  );
}