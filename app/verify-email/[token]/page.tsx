import { verifyEmail } from "@/app/actions/auth";
import Image from "next/image";
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
            <main className="container">
                <div className="logo">
                    <Image className="logo-img" src="/assets/QuizWeb-Logo.svg" width={96} height={96} alt=""/>
                </div>

                <h1 className="yay">
                    Email Verified!
                </h1>

                <p className="message">
                    {result.message} <br />
                    You may now close this tab.
                </p>
            </main>
        );
    }

    return (
        <main className="container">
            <div className="logo">
                <Image className="logo-img" src="/assets/QuizWeb-Logo.svg" width={96} height={96} alt=""/>
            </div>

            <h1 className="nay">
                {result.expired
                    ? "Verification Link Expired"
                    : "Verification Failed"}
            </h1>

            <p className="message">
                {result.message}
            </p>
        </main>
    )
}