"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
// import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";
import "#css/learn.css";
import Link from "next/link";

export default function LearnUiPage() {
    const [showLessonDetail, setShowLessonDetail] = useState(false);

    const handleLevelClick = (event: MouseEvent<HTMLDivElement>) => {
        const target = event.target;
        if (target instanceof Element && target.closest(".level-btn")) {
            setShowLessonDetail(true);
        }
    };

    const handleLevelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if ((event.key === "Enter" || event.key === " ") &&
            event.target instanceof HTMLElement &&
            event.target.matches(".level-btn")) {
            event.preventDefault();
            setShowLessonDetail(true);
        }
    };

    return (
    <div className="quiz-page quiz-no-footer-page learn-page">
        <Sidebar />
        <main>
            <div className="learn-content">
                <div className="section-detail-rail">
                    <div className="section-detail">
                        <h1>Getting Started</h1>
                        {/* For description, chat niyo ako -clarence */}
                        <p id="section-description">Learn how an HTML page is built, from the doctype and the head/body skeleton to basic text like headings, paragraphs and lists.</p>
                        <div className="section-stats">
                            <div className="icon-label">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-boxes preview-icon"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/></svg>
                                {/* Total Units ng Section 1 */}
                                <p>2 Units</p>
                            </div>
                            <div className="icon-label">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-presentation preview-icon"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg>
                                {/* Total Lesson Slides ng Unit 1 and 2 */}
                                <p>15 Lesson Slides</p>
                            </div>
                            <div className="icon-label">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-question-mark preview-icon"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                                {/* Total Questions ng Unit 1 and Unit 2 */}
                                <p>23 Questions</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="roadmap" onClick={handleLevelClick} onKeyDown={handleLevelKeyDown}>
                    {showLessonDetail && <div className="lesson-detail-container">
                        <div className="lesson-detail">
                            <div className="lesson-detail-icon-label">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open preview-icon"><path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/></svg>
                                <p>Learn</p>
                            </div>
                            <div className="lesson-detail-icon-label hidden">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-code preview-icon"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>
                                <p>Code Problem</p>
                            </div>
                            <div className="lesson-detail-icon-label hidden">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-question-mark preview-icon"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                                <p>Learn</p>
                            </div>
                            {/* Unit Title */}
                            <h2>Document Structure</h2>
                        </div>
                        <Link href={"/"} className="lesson-link"><p>Start</p></Link>
                    </div>}
                    <div className="section-header">
                        <p>HTML, Section 1</p>
                        {/* Section Title */}
                        <h2>Getting Started</h2>
                    </div>
                    <div className="level-row">
                        <div className="level-content">
                            <div className="level">
                                <div className="level-btn complete">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check preview-icon"><path d="M20 6 9 17l-5-5"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="level-row">
                        <div className="level-content">
                            <div className="level">
                                <div className="level-btn complete">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check preview-icon"><path d="M20 6 9 17l-5-5"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="level-row">
                        <div className="level-content">
                            <div className="level">
                                <div className="level-btn complete">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check preview-icon"><path d="M20 6 9 17l-5-5"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="level-row-divider">
                        <hr></hr>
                        {/* Unit Title (Unit 2) */}
                        <p>Text Content</p>
                        <hr></hr>
                    </div>
                    {/* Lesson, Current Level */} 
                    <div className="level-row">
                        <div className="level-content">
                            <div className="level">
                                <div className="level-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open preview-icon"><path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Quiz */}
                    <div className="level-row">
                        <div className="level-content">
                            <div className="level">
                                <div className="level-btn disabled">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M8 8.00447C8.36294 7.00272 9.07931 6.15801 10.0222 5.61995C10.9651 5.08189 12.0738 4.88521 13.1517 5.06473C14.2297 5.24426 15.2074 5.78841 15.9118 6.60081C16.6161 7.41321 17.0016 8.44143 17 9.50335C17 12.5011 12 14.5 12 14.5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/> <path d="M12 20H12.01" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Code Problem */}
                    <div className="level-row">
                        <div className="level-content">
                            <div className="level">
                                <div className="level-btn disabled">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-code preview-icon"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="section-header disabled" style={{marginTop:"20px"}}>
                        <p>HTML, Section 2</p>
                        <h2>Linking Your World</h2>
                    </div>

                    <div className="level-row">
                        <div className="level-content">
                            {/* Skip Section */}
                            <div className="level">
                                <div className="level-btn">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M14 20L21 12.5L14 5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/> <path d="M5 20L12 12.5L5 5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/> </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
    );
}