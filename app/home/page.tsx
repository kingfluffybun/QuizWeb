import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import "#css/dashboard.css";
import "#css/sidebar.css"
import Sidebar from "@/app/components/Sidebar";
import Leaderboard from "@/app/components/Leaderboard";
import StreakCalendar from "./StreakCalendar";
import { getUserStreakData } from "@/app/actions/streak";
import { getLeaderboardEntries } from "@/app/actions/leaderboard";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const streakData = await getUserStreakData();
    const initialLeaderboardEntries = await getLeaderboardEntries("daily");

    return (
        <div className="dashboard-page">
            <Sidebar />
            <main>
                <div className="dashboard-content">
                    <div className="welcome-banner">
                        <div>
                            <h1>Welcome, {session?.user?.name || 'User'}</h1>
                            <p>Your daily goal is waiting — jump in and earn some XP!</p>
                            <Image src="/assets/landing-page/Clouds-right.svg" width={180} height={180} alt="" className="cloud-right"/>
                        </div>
                    </div>
                    <nav className="dashboard-mobile-jumpbar" aria-label="Jump to dashboard section">
                        <a href="#dashboard-progress" className="dashboard-jump-pill">Overview</a>
                        <a href="#streak-calendar" className="dashboard-jump-pill">Streak</a>
                        <a href="#leaderboard" className="dashboard-jump-pill">Leaderboard</a>
                    </nav>
                    <div className="dashboard">
                        <div className="two-col-card" id="dashboard-progress">
                            <div className="card">
                                <div className="card-title">
                                    <h2>Lesson Progress</h2>
                                    <h2 className="quick-action">View All</h2>
                                </div>
                                <div className="lesson-progress col">   
                                    <div className="lesson-progress-header">
                                        <div className="lesson-progress-details">
                                            <div className="current-lesson">
                                                <div className="language-icon col">
                                                    {/* HTML */}
                                                    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" id="html"><title>HTML5</title><path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/></svg>
                                                    {/* CSS */}
                                                    {/* <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>CSS</title><path d="M0 0v20.16A3.84 3.84 0 0 0 3.84 24h16.32A3.84 3.84 0 0 0 24 20.16V3.84A3.84 3.84 0 0 0 20.16 0Zm14.256 13.08c1.56 0 2.28 1.08 2.304 2.64h-1.608c.024-.288-.048-.6-.144-.84-.096-.192-.288-.264-.552-.264-.456 0-.696.264-.696.84-.024.576.288.888.768 1.08.72.288 1.608.744 1.92 1.296q.432.648.432 1.656c0 1.608-.912 2.592-2.496 2.592-1.656 0-2.4-1.032-2.424-2.688h1.68c0 .792.264 1.176.792 1.176.264 0 .456-.072.552-.24.192-.312.24-1.176-.048-1.512-.312-.408-.912-.6-1.32-.816q-.828-.396-1.224-.936c-.24-.36-.36-.888-.36-1.536 0-1.44.936-2.472 2.424-2.448m5.4 0c1.584 0 2.304 1.08 2.328 2.64h-1.608c0-.288-.048-.6-.168-.84-.096-.192-.264-.264-.528-.264-.48 0-.72.264-.72.84s.288.888.792 1.08c.696.288 1.608.744 1.92 1.296.264.432.408.984.408 1.656.024 1.608-.888 2.592-2.472 2.592-1.68 0-2.424-1.056-2.448-2.688h1.68c0 .744.264 1.176.792 1.176.264 0 .456-.072.552-.24.216-.312.264-1.176-.048-1.512-.288-.408-.888-.6-1.32-.816-.552-.264-.96-.576-1.2-.936s-.36-.888-.36-1.536c-.024-1.44.912-2.472 2.4-2.448m-11.031.018c.711-.006 1.419.198 1.839.63.432.432.672 1.128.648 1.992H9.336c.024-.456-.096-.792-.432-.96-.312-.144-.768-.048-.888.24-.12.264-.192.576-.168.864v3.504c0 .744.264 1.128.768 1.128a.65.65 0 0 0 .552-.264c.168-.24.192-.552.168-.84h1.776c.096 1.632-.984 2.712-2.568 2.688-1.536 0-2.496-.864-2.472-2.472v-4.032c0-.816.24-1.44.696-1.848.432-.408 1.146-.624 1.857-.63"/></svg> */}
                                                    {/* JS */}
                                                    {/* <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>JavaScript</title><path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z"/></svg> */}
                                                </div>
                                                <div>
                                                    <h2>HTML Section 1</h2>
                                                    <p>Section 1 of 16</p>
                                                </div>
                                            </div>
                                            <div className="row"><h1>0%</h1></div>
                                        </div>
                                        <div className="lesson-progress-bar">
                                            <div className="progress-bar-fill"></div>
                                        </div>
                                    </div>
                                    <hr></hr>
                                    <div className="unit-list-dashboard">
                                        <div className="unit row">
                                            <div className="unit-no row"><p>1</p></div>
                                            <div className="unit-info">
                                                <div className="unit-description">
                                                    <p id="unit-title">Document Structure</p>
                                                    <p>0/6</p>
                                                </div>
                                                <div className="unit-progress-bar">
                                                    <div className="progress-bar-fill"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="unit row">
                                            <div className="unit-no row"><p>2</p></div>
                                            <div className="unit-info">
                                                <div className="unit-description">
                                                    <p id="unit-title">Text Content</p>
                                                    <p>0/7</p>
                                                </div>
                                                <div className="unit-progress-bar">
                                                    <div className="progress-bar-fill"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* <div>
                                    <div>
                                        <div><p>1</p></div>
                                        <div>
                                            <p>Document Structure</p>
                                            <p>0/6</p>
                                        </div>
                                        <div>
                                            bar
                                        </div>
                                    </div>
                                </div> */}
                            </div>
                            <div className="card">
                                <div className="card-title">
                                    <h2>Daily Goal</h2>
                                    <h2 className="quick-action">Edit Goal</h2>
                                </div>
                                <div className="daily-goal-xp">
                                    <p>XP Progress</p>
                                    <div className="daily-progress-bar-container row">
                                        <div className="daily-progress-bar">
                                            <div className="progress-bar-fill" style={{width: "50%"}}></div>
                                        </div>
                                        <div><p>15/30</p></div>
                                    </div>
                                    <div className="daily-prograss-graph">
                                        <div className="graph-x-axis-container">
                                            <div className="graph-x-axis">
                                                <p>40</p>
                                                <div className="x-axis-line"></div>
                                            </div>
                                            <div className="graph-x-axis">
                                                <p>30</p>
                                                <div className="x-axis-line"></div>
                                            </div>
                                            <div className="graph-x-axis">
                                                <p>20</p>
                                                <div className="x-axis-line"></div>
                                            </div>
                                            <div className="graph-x-axis">
                                                <p>10</p>
                                                <div className="x-axis-line"></div>
                                            </div>
                                            <div className="graph-x-axis">
                                                <p>0</p>
                                                <div className="x-axis-line"></div>
                                            </div>
                                        </div>
                                        <div className="graph-y-axis">
                                            <div>
                                                <div className="graph-y-bar"></div>
                                                <p>Su</p>
                                            </div>
                                            <div>
                                                <div className="graph-y-bar"></div>
                                                <p>Mo</p>
                                            </div>
                                            <div>
                                                <div className="graph-y-bar"></div>
                                                <p>Tu</p>
                                            </div>
                                            <div>
                                                <div className="graph-y-bar"></div>
                                                <p>We</p>
                                            </div>
                                            <div>
                                                <div className="graph-y-bar"></div>
                                                <p>Th</p>
                                            </div>
                                            <div>
                                                <div className="graph-y-bar"></div>
                                                <p>Fr</p>
                                            </div>
                                            <div>
                                                <div className="graph-y-bar"></div>
                                                <p>Sa</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Streak */}
                        <StreakCalendar initialData={streakData} />

                        <div className="card">
                            <div className="card-title">
                                <h2>Continue Where You Left Off</h2>
                                <a href="/learn"><h2 className="quick-action">Resume</h2></a>
                            </div>
                            <p>Pick up right where you left off in the interactive curriculum to maintain your streak.</p>
                        </div>
                    </div>

                    <Leaderboard initialEntries={initialLeaderboardEntries} />
                </div>
            </main>
            
        </div>
    );
}