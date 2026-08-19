import { auth } from "@/auth";
import Link from "next/link";

export default async function SessionTestPage() {
    // 1. Fetch the session securely on the server
    const session = await auth();

    return (
        <main style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto" }}>
            <h1>Session Logic Test</h1>
            
            {session ? (
                <div style={{ padding: "20px", border: "2px solid #4CAF50", borderRadius: "8px", marginTop: "20px", backgroundColor: "#f9fff9" }}>
                    <h2 style={{ color: "#4CAF50", marginTop: 0 }}>✅ User is Authenticated</h2>
                    
                    <ul style={{ lineHeight: "1.8", fontSize: "16px" }}>
                        <li><strong>Database ID:</strong> {session.user?.id}</li>
                        <li><strong>Email:</strong> {session.user?.email}</li>
                        <li><strong>Player Username:</strong> {session.user?.name}</li>
                    </ul>

                    <div style={{ marginTop: "20px" }}>
                        <h3>Raw Token Payload:</h3>
                        <pre style={{ backgroundColor: "#2d2d2d", color: "#fff", padding: "15px", borderRadius: "6px", overflowX: "auto" }}>
                            {JSON.stringify(session, null, 2)}
                        </pre>
                    </div>

                    {/* Example of a NextAuth server-side sign out route */}
                    <form action="/api/auth/signout" method="POST" style={{ marginTop: "20px" }}>
                        <button type="submit" style={{ padding: "10px 15px", background: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                            Sign Out
                        </button>
                    </form>
                </div>
            ) : (
                <div style={{ padding: "20px", border: "2px solid #f44336", borderRadius: "8px", marginTop: "20px", backgroundColor: "#fff5f5" }}>
                    <h2 style={{ color: "#f44336", marginTop: 0 }}>❌ No Active Session</h2>
                    <p>NextAuth did not find a valid httpOnly cookie for this request.</p>
                    
                    <Link href="/">
                        <button style={{ marginTop: "10px", padding: "10px 15px", background: "#2196F3", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                            Go to Login Page
                        </button>
                    </Link>
                </div>
            )}
        </main>
    );
}