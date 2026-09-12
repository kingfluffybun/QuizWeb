import { verifyEmail } from "@/app/actions/auth";
import CloseVerification from "@/app/components/CloseVerification";
import Image from "next/image";
import "@/public/css/verify.css";

interface VerifyEmailPageProps {
    params: Promise<{ token: string; }>;
}

export default async function VerifyEmailPage({
    params,
}: VerifyEmailPageProps) {
    const { token } = await params;
    const result  = await verifyEmail(token);

    return (
        <main className="main-email">
            <div className="email-container">
                <div className="logo">
                    <Image className="logo-img" src="/assets/QuizWeb-Logo.svg" width={96} height={96} alt="" />
                </div>
                {result.success ? (
                    <>
                        <div className="success-logo">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-badge-check"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m16 9-5.5 5.5L8 12"/></svg>
                        </div>

                        <h1 className="success-title">
                            Email Verified!
                        </h1>

                        <p className="success-message">
                            Your email has been verified. <br /> You may now close this tab.
                        </p>

                        <CloseVerification />
                    </>
                ) : (
                    <>
                        <div className="failed-logo">
                            <Image className="logo-img" src="/assets/QuizWeb-Logo.svg" width={96} height={96} alt="" />
                        </div>

                        <h1 className="failed-title">
                            Verification Failed
                        </h1>

                        <p className="failed-message">
                            {result.message}
                        </p>
                    </>
                )}
            </div>
        </main>
    )

    // if (result.success) {
    //     return (
    //         <main className="container">
    //             <div className="logo">
    //                 <Image className="logo-img" src="/assets/QuizWeb-Logo.svg" width={96} height={96} alt=""/>
    //             </div>

    //             <h1 className="yay">
    //                 Email Verified!
    //             </h1>

    //             <p className="message">
    //                 {result.message} <br />
    //                 You may now close this tab.
    //             </p>
    //         </main>
    //     );
    // }

    // return (
    //     <main className="container">
    //         <div className="logo">
    //             <Image className="logo-img" src="/assets/QuizWeb-Logo.svg" width={96} height={96} alt=""/>
    //         </div>

    //         <h1 className="nay">
    //             {result.expired
    //                 ? "Verification Link Expired"
    //                 : "Verification Failed"}
    //         </h1>

    //         <p className="message">
    //             {result.message}
    //         </p>
    //     </main>
    // )
}