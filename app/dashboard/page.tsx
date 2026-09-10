import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import "#css/nav.css";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    async function handleSignOut() {
        "use server";
        await signOut({ redirectTo: "/login" });
    }

    const isAdmin = session.user.role === "admin";

    return (
        <div style={{ maxWidth: "800px", margin: "40px auto", padding: "24px", fontFamily: "var(--font-poppins, sans-serif)" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", borderBottom: "1px solid var(--border-main, #e0e0e0)", paddingBottom: "16px" }}>
                <div>
                    <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-main, #333333)", margin: "0 0 4px 0" }}>User Dashboard</h1>
                    <p style={{ color: "var(--text-muted, #666666)", margin: 0 }}>Welcome back, {session.user.name || "Learner"}!</p>
                </div>

                <form action={handleSignOut}>
                    <button type="submit" style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-main, #ccc)", background: "transparent", cursor: "pointer", fontWeight: "500" }}>
                        Sign Out
                    </button>
                </form>
            </header>

            <main style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <section style={{ padding: "24px", borderRadius: "12px", border: "1px solid var(--border-main, #e0e0e0)", background: "var(--bg-card, #ffffff)" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "var(--text-main, #333333)" }}>Account Profile</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "12px", fontSize: "15px" }}>
                        <span style={{ color: "var(--text-muted, #666666)" }}>Username:</span>
                        <span style={{ fontWeight: "500", color: "var(--text-main, #333333)" }}>{session.user.name || "Not set"}</span>

                        <span style={{ color: "var(--text-muted, #666666)" }}>Email:</span>
                        <span style={{ fontWeight: "500", color: "var(--text-main, #333333)" }}>{session.user.email}</span>

                        <span style={{ color: "var(--text-muted, #666666)" }}>Role:</span>
                        <span>
                            <span style={{
                                padding: "2px 10px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: "600",
                                background: isAdmin ? "#E8DEFF" : "#E8F5E9",
                                color: isAdmin ? "#7333E6" : "#2E7D32",
                                textTransform: "uppercase"
                            }}>
                                {session.user.role || "user"}
                            </span>
                        </span>
                    </div>
                </section>

                <section style={{ padding: "24px", borderRadius: "12px", border: "1px solid var(--border-main, #e0e0e0)", background: "var(--bg-card, #ffffff)" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", color: "var(--text-main, #333333)" }}>Quick Links</h2>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <Link href="/quiz" style={{ textDecoration: "none", padding: "10px 20px", borderRadius: "8px", background: "var(--primary-color, #7333E6)", color: "#ffffff", fontWeight: "600" }}>
                            Start Learning &rarr;
                        </Link>
                        {isAdmin && (
                            <Link href="/input" style={{ textDecoration: "none", padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--primary-color, #7333E6)", color: "var(--primary-color, #7333E6)", fontWeight: "600" }}>
                                Admin Panel
                            </Link>
                        )}
                        {isAdmin && (
                            <Link href="/pending" style={{ textDecoration: "none", padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border-main, #ccc)", color: "var(--text-main, #333333)", fontWeight: "500" }}>
                                Review Submissions
                            </Link>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}