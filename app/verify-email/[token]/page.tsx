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
                    <p className="logo-text">QuizWeb</p>
                </div>
                {result.success ? (
                    <>
                        <div className="success-logo">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#9966FF" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-badge-check success-icon"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m16 9-5.5 5.5L8 12"/></svg>
                        </div>

                        <p className="success-title">
                            Email Verified!
                        </p>

                        <p className="message">
                            Automatically closing...
                        </p>

                        {/* <CloseVerification /> */}
                    </>
                ) : (
                    <>
                        <div className="failed-logo">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ef2e2e" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-triangle-alert failed-icon"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                            {/* <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-badge-alert failed-icon"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg> */}
                        </div>

                        <p className="failed-title">
                            Verification Failed
                        </p>

                        <p className="message">
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