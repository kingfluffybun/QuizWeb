import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";

export default async function DashboardPage(
    props: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
    const searchParams = await props.searchParams;
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || 'Unknown';
    const host = headersList.get('host') || 'Unknown';
    const isSecureContext = headersList.get('x-forwarded-proto') === 'https';
    const referer = headersList.get('referer') || 'None';
    const acceptLanguage = headersList.get('accept-language') || 'None';

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    const serverTime = new Date().toISOString();

    async function handleSignOut() {
        "use server";
        await signOut({ redirectTo: "/login" });
    }

    return (
        <div>
            <header>
                <p>Welcome, {session?.user?.name || 'User'}!</p>

                <form action={handleSignOut}>
                    <button type="submit">
                        Sign Out
                    </button>
                </form>
            </header>

            <hr />

            <main>
                <section>
                    <pre>
                        {JSON.stringify(session, null, 2)}
                    </pre>
                </section>

                <hr />

                <section>
                    <pre>
                        {JSON.stringify({
                            host,
                            userAgent,
                            referer,
                            acceptLanguage,
                            isSecureContext
                        }, null, 2)}
                    </pre>
                </section>

                <hr />

                <section>
                    <pre>
                        {JSON.stringify(allCookies, null, 2)}
                    </pre>
                </section>

                <hr />

                <section>
                    <pre>
                        {JSON.stringify(searchParams, null, 2)}
                    </pre>
                </section>

                <hr />

                <section>
                    <pre>
                        {JSON.stringify({
                            nodeEnv: process.env.NODE_ENV,
                            serverTime,
                            configChecks: {
                                hasAuthSecret: !!process.env.AUTH_SECRET,
                                hasDatabaseUrl: !!process.env.DATABASE_URL,
                            }
                        }, null, 2)}
                    </pre>
                </section>
            </main>
        </div>
    );
}