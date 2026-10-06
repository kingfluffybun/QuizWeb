import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import Image from "next/image";
import "#css/dashboard.css";
import "#css/sidebar.css"
import Sidebar from "@/app/components/Sidebar";

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
        <div className="dashboard-page">
            <Sidebar />
            <main>
                {/* <header>
                        <p>Welcome, {session?.user?.name || 'User'}!</p>

                        <form action={handleSignOut}>
                            <button type="submit">
                                Sign Out
                            </button>
                        </form>
                    </header>

                    <hr />
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
                </section> */}
                <div className="dashboard-content">
                    <div className="welcome-banner">
                        <div>
                            <h1>Welcome, {session?.user?.name || 'User'}</h1>
                            <p>Your daily goal is waiting — jump in and earn some XP!</p>
                            <Image src="/assets/landing-page/Clouds-right.svg" width={180} height={180} alt="" className="cloud-right"/>
                        </div>
                    </div>
                    <div className="dashboard">
                        <div className="two-col-card">
                            <div className="card">
                                <h2>Lesson Progress</h2>
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
                                        <div className="lesson-progress-bar"></div>
                                    </div>
                                    <hr></hr>
                                    <div className="unit-list">
                                        <div className="unit row">
                                            <div className="unit-no row"><p>1</p></div>
                                            <div className="unit-info">
                                                <div className="unit-description">
                                                    <p id="unit-title">Document Structure</p>
                                                    <p>0/6</p>
                                                </div>
                                                <div className="unit-progress-bar"></div>
                                            </div>
                                        </div>
                                        <div className="unit row">
                                            <div className="unit-no row"><p>2</p></div>
                                            <div className="unit-info">
                                                <div className="unit-description">
                                                    <p id="unit-title">Text Content</p>
                                                    <p>0/7</p>
                                                </div>
                                                <div className="unit-progress-bar"></div>
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
                                <h2>Daily Goal</h2>
                                <div className="daily-goal-xp">
                                    <p>XP Progress</p>
                                    <div className="daily-progress-bar-container row">
                                        <div className="daily-progress-bar"></div>
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
                                            <div><p>Su</p></div>
                                            <div><p>Mo</p></div>
                                            <div><p>Tu</p></div>
                                            <div><p>We</p></div>
                                            <div><p>Th</p></div>
                                            <div><p>Fr</p></div>
                                            <div><p>Sa</p></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card" id="streak-calendar">
                            <h2>Streak Calendar</h2>
                            <div className="calendar-container">
                                <div className="calendar">
                                    <div className="calendar-month"><p>October 2026</p></div>
                                    <div className="day-label"><p>Sun</p></div>
                                    <div className="day-label"><p>Mon</p></div>
                                    <div className="day-label"><p>Tue</p></div>
                                    <div className="day-label"><p>Wed</p></div>
                                    <div className="day-label"><p>Thu</p></div>
                                    <div className="day-label"><p>Fri</p></div>
                                    <div className="day-label"><p>Sat</p></div>
                                    <div className="day-empty"></div>
                                    <div className="day-empty"></div>
                                    <div className="day-empty"></div>
                                    <div className="day-empty"></div>
                                    <div className="day col active"><p>1</p></div>
                                    <div className="day col active"><p>2</p></div>
                                    <div className="day col active"><p>3</p></div>
                                    {/* week 2 */}
                                    <div className="day col active"><p>4</p></div>
                                    <div className="day col"><p>5</p></div>
                                    <div className="day col"><p>6</p></div>
                                    <div className="day col"><p>7</p></div>
                                    <div className="day col"><p>8</p></div>
                                    <div className="day col"><p>9</p></div>
                                    <div className="day col"><p>10</p></div>
                                    {/* week 3 */}
                                    <div className="day col"><p>11</p></div>
                                    <div className="day col"><p>12</p></div>
                                    <div className="day col"><p>13</p></div>
                                    <div className="day col"><p>14</p></div>
                                    <div className="day col"><p>15</p></div>
                                    <div className="day col"><p>16</p></div>
                                    <div className="day col"><p>17</p></div>
                                    {/* week 4 */}
                                    <div className="day col"><p>18</p></div>
                                    <div className="day col"><p>19</p></div>
                                    <div className="day col"><p>20</p></div>
                                    <div className="day col"><p>21</p></div>
                                    <div className="day col"><p>22</p></div>
                                    <div className="day col"><p>23</p></div>
                                    <div className="day col"><p>24</p></div>
                                    {/* week 5 */}
                                    <div className="day col"><p>25</p></div>
                                    <div className="day col"><p>26</p></div>
                                    <div className="day col"><p>27</p></div>
                                    <div className="day col"><p>28</p></div>
                                    <div className="day col"><p>29</p></div>
                                    <div className="day col"><p>30</p></div>
                                    <div className="day col"><p>31</p></div>
                                </div>
                                <div className="streak-no col">
                                    <div className="streak-progress-bar col">
                                        <svg width="547" height="624" viewBox="0 0 547 624" fill="none" xmlns="http://www.w3.org/2000/svg"> <path fillRule="evenodd" clipRule="evenodd" d="M219.095 23.8317C212.459 64.1343 205.4 86.4878 190.467 114.633C170.255 152.704 143.015 186.52 102.712 223.565C44.8828 276.689 14.8066 323.839 2.89081 380.1C-0.668852 396.963 -1.00068 431.474 2.22715 448.88C13.8112 511.295 57.402 566.56 119.485 597.602C146.243 610.965 167.45 617.24 200.09 621.403C210.558 622.761 219.518 623.847 219.97 623.847C220.453 623.847 217.044 621.313 212.459 618.236C202.142 611.327 184.585 594.525 176.681 584.057C151.431 550.542 143.648 506.83 156.288 469.393C165.58 441.791 185.188 413.585 210.92 390.87C229.985 374.037 249.021 360.703 287.996 336.871L292.431 334.186L299.972 356.842C311.798 392.348 314.965 398.532 336.564 427.763C343.925 437.718 352.523 450.117 355.66 455.336C371.709 482.033 377.259 513.346 370.592 539.561C361.693 574.645 341.964 604.51 317.348 620.106C310.319 624.601 309.987 624.571 336.625 621.403C382.448 615.973 415.179 606.772 444.682 591.055C481.455 571.477 507.549 544.327 524.925 507.584C535.182 485.925 541.275 463.782 545.046 434.4C547.309 416.994 546.947 376.058 544.413 361.457C535.574 310.234 513.492 260.006 474.728 202.72C456.356 175.63 439.101 154.845 412.584 127.937L388.24 103.23L377.561 124.618C371.678 136.383 366.58 146.007 366.188 146.007C365.796 146.007 364.227 142.869 362.689 139.068C347.364 100.877 317.107 62.445 281.661 36.1698C274.119 30.589 224.827 0 223.379 0C223.198 0 221.267 10.7393 219.095 23.8317Z" fill="#FF7504"/> </svg>
                                    </div>
                                    <div className="streak-day col">
                                        <h1>4</h1>
                                        <p>Days Streak!</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="card"><h2>Continue Where You Left Off</h2></div>
                    </div>
                    <div className="leaderboard ">
                        <div className="card">
                            <div>
                                <h2>Leaderboard</h2>
                                <div className="sort-by-time">
                                    <input type="radio" name="leaderboard-time" id="lb-daily" defaultChecked />
                                    <label htmlFor="lb-daily"><p>Day</p></label>
                                    <input type="radio" name="leaderboard-time" id="lb-weekly" />
                                    <label htmlFor="lb-weekly"><p>Week</p></label>
                                    <input type="radio" name="leaderboard-time" id="lb-monthly" />
                                    <label htmlFor="lb-monthly"><p>Month</p></label>
                                    <input type="radio" name="leaderboard-time" id="lb-alltime" />
                                    <label htmlFor="lb-alltime"><p>All Time</p></label>
                                </div>
                            </div>
                            <div className="podium">
                                <div className="podium-place-container">
                                    <div className="player-icon">
                                        <div className="podium-player-xp"><p>200 XP</p></div>
                                    </div>
                                    <div className="podium-place" id="second-place"><h1>2</h1></div>
                                    <p id="player-name">Jerald A.</p>
                                </div>
                                <div className="podium-place-container">   
                                    <div className="player-icon">
                                        <div className="podium-player-xp"><p>300 XP</p></div>
                                    </div>
                                    <div className="podium-place" id="first-place"><h1>1</h1></div>
                                    <p id="player-name">Talon G.</p>
                                </div>
                                <div className="podium-place-container">
                                    <div className="player-icon">
                                        <div className="podium-player-xp"><p>150 XP</p></div>
                                    </div>
                                    <div className="podium-place" id="third-place"><h1>3</h1></div>
                                    <p id="player-name">Caitlyn H.</p>
                                </div>
                            </div>
                            <div className="leaderboard-placement">
                                <div className="leaderboard-player row" id="nth-place">
                                    <div className="player-details row">
                                        <p>4</p>
                                        <div className="player-icon"></div>
                                        <p id="player-name">Clarence Luna</p>
                                    </div>
                                    <p>100 XP</p>
                                </div>
                                <div className="leaderboard-player row" id="nth-place">
                                    <div className="player-details row">
                                        <p>5</p>
                                        <div className="player-icon"></div>
                                        <p id="player-name">Kevenly Luistro</p>
                                    </div>
                                    <p>100 XP</p>
                                </div>
                                <div className="leaderboard-player row" id="nth-place">
                                    <div className="player-details row">
                                        <p>6</p>
                                        <div className="player-icon"></div>
                                        <p id="player-name">Ricky Parica</p>
                                    </div>
                                    <p>100 XP</p>
                                </div>
                                <div className="leaderboard-player row" id="nth-place">
                                    <div className="player-details row">
                                        <p>7</p>
                                        <div className="player-icon"></div>
                                        <p id="player-name">Harvy Bautista</p>
                                    </div>
                                    <p>100 XP</p>
                                </div>
                                <div className="leaderboard-player row" id="nth-place">
                                    <div className="player-details row">
                                        <p>8</p>
                                        <div className="player-icon"></div>
                                        <p id="player-name">Jomari Wamil</p>
                                    </div>
                                    <p>100 XP</p>
                                </div>
                                <div className="leaderboard-player row" id="nth-place">
                                    <div className="player-details row">
                                        <p>9</p>
                                        <div className="player-icon"></div>
                                        <p id="player-name">Christian Panti</p>
                                    </div>
                                    <p>100 XP</p>
                                </div>
                                <div className="leaderboard-player row" id="nth-place">
                                    <div className="player-details row">
                                        <p>10</p>
                                        <div className="player-icon"></div>
                                        <p id="player-name">Rommel</p>
                                    </div>
                                    <p>100 XP</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
        </div>
    );
}