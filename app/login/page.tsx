"use client";

import Image from "next/image";
import "#css/login.css";

export default function LoginPage() {
    return (
        <body className="auth-page">
            <main className="auth-card" id="auth">
                <div className="editor-bar" aria-hidden="true">
                    <span className="editor-dots"><span></span><span></span><span></span></span>
                    <div className="editor-tabs">
                        <span className="editor-tab active"><span className="tab-dot"></span>index.html</span>
                        <span className="editor-tab"><span className="tab-dot"></span>style.css</span>
                    </div>
                </div>

                <section className="info" aria-label="Authentication Info">
                    <div className="brand">
                        <div className="brand-mark" aria-hidden="true"></div>
                        <span>QuizWeb</span>
                    </div>

                    {/* tuloy mo dto kev */}
                </section>
            </main>
        </body>
    )
}