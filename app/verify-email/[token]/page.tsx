import { verifyEmail } from "@/app/actions/auth";
import "@/public/css/verify.css";

export default async function VerifyEmailPage({
    params,
}: {
    params: Promise<{ token: string}>;
}) {
    const { token } = await params;
    const result  = await verifyEmail(token);

    if (result.success) {
        return (
            <main>
                <div>
                    <h1>
                        Email Verified!
                    </h1>

                    <p>
                        {result.message}
                    </p>

                    <p>
                        You may now close this tab.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-3xl font-bold">
                    {result.expired
                        ? "Verification Link Expired"
                        : "Verification Failed"}
                </h1>

                <p className="mt-3 text-gray-500">
                    {result.message}
                </p>
            </div>
        </main>
    )
}