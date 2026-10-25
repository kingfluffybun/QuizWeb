"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { UserInfoResponse } from "@/app/api/db/user-info/route";
import Sidebar from "@/app/components/Sidebar";
import ProfileSkeleton from "@/app/components/skeletons/ProfileSkeleton";
// import { useRouter } from 'next/navigation';
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";
import "#css/profile.css";

type ProfileIconName = "edit" | "flame" | "check" | "code" | "award" | "calendar" | "lock" | "user" | "mail" | "target" | "user-pen" | "user-shield";

const profileIconPaths: Record<ProfileIconName, ReactNode> = {
    edit: <><path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></>,
    flame: <><path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
    code: <><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></>,
    award: <><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></>,
    calendar: <><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></>,
    lock: <><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    user: <><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="5"/></>,
    mail: <><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    "user-pen": <><path d="M11.5 15H7a4 4 0 0 0-4 4v2"/><path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><circle cx="10" cy="7" r="4"/></>,
    "user-shield": <><path d="M10 15H6a4 4 0 0 0-4 4v2"/><path d="M22 17.5c0 2.499-1.75 3.749-3.83 4.474a.5.5 0 0 1-.335-.005c-2.085-.72-3.835-1.97-3.835-4.47V14a.5.5 0 0 1 .5-.499c1 0 2.25-.6 3.12-1.36a.6.6 0 0 1 .76-.001c.875.765 2.12 1.36 3.12 1.36a.5.5 0 0 1 .5.5z"/><circle cx="9" cy="7" r="4"/></>,
};

function ProfileIcon({ name }: { name: ProfileIconName }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-${name} preview-icon`}>
            {profileIconPaths[name]}
        </svg>
    );
}

const activity = [
    { day: "Sun", completed: true },
    { day: "Sat", completed: true },
    { day: "Mon", completed: true },
    { day: "Tue", completed: true },
    { day: "Wed", completed: false, today: true },
    { day: "Thu", completed: false },
    { day: "Fri", completed: false },
];

const weeklyGoal = 7;
const completedActivityDays = activity.filter(({ completed }) => completed).length;
const currentStreakDays = completedActivityDays;

export default function ProfilePage() {
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);
    const [username, setUsername] = useState<string | undefined>();
    const [email, setEmail] = useState<string | undefined>();
    const [avaColor, setAvaColor] = useState<string | undefined>();
    const [learningGoal, setLearningGoal]  = useState<string | undefined>();
    const [createdDate, setCreatedDate] = useState<string>();

    const [draft, setDraft] = useState<{ username?: string; email?: string; learningGoal?: string }>({
        username: undefined,
        learningGoal: undefined
    });
    const [isEditing, setIsEditing] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");

    // const router = useRouter();

    useEffect(() => {
        let isMounted = true;
        fetch("/api/db/user-info")
            .then(async (res) => {
                const json = await res.json();
                if (!isMounted || !res.ok) return;
                if (Object.keys(json).length === 0) return;
                
                const userData: UserInfoResponse | undefined = json as UserInfoResponse | undefined;

                setUsername(userData?.username);
                setEmail(userData?.email);
                setAvaColor(userData?.avatar_color);
                setCreatedDate(userData?.created_at);
                setLearningGoal(userData?.learning_goal);
                setDraft({
                    username: userData?.username,
                    learningGoal: userData?.learning_goal
                });
                setIsProfileLoaded(true);

                console.log(userData);
            })
            .catch((err) => {
                // Silently fallback to unauthenticated/user default
                console.error("API Fetch encountered an error:", err);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const oldDate = createdDate ? new Date(createdDate) : null;
    const formatDate = oldDate && !isNaN(oldDate.getTime())
        ? oldDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : "Recently";

    const handleSave = async () => {
        try {
            const usernameValue = draft?.username || username;
            const emailValue = draft?.email || email;
            const learningGoalValue = draft?.learningGoal || learningGoal || undefined;

            console.log("Saving values:");
            console.log("- Username:", JSON.stringify(usernameValue));
            console.log("- Learning Goal:", JSON.stringify(learningGoalValue));

            const payload = {
                username: (usernameValue || "").trim(),
                learning_goal: learningGoalValue?.trim() || undefined
            };

            console.log("Final payload:", JSON.stringify(payload));

            const response = await fetch('/api/db/user-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }

            const result = await response.json();

            setSaveMessage("");

            setUsername(result.username);
            setEmail(emailValue);
            setLearningGoal(result.learning_goal || undefined);

            setDraft({
                username: result.username,
                email: result.email,
                learningGoal: result.learning_goal || undefined
            });

            setSaveMessage("Profile updated successfully!");

            setIsEditing(false);
        } catch (error: any) {
            console.error("Error in handleSave:", error);

            let errorMessage = "Failed to save changes. Please try again.";

            if (error?.message?.includes('fetch')) {
                errorMessage = "Network error - cannot connect to server."
            }

            alert(errorMessage);
            setSaveMessage(errorMessage);
        }
    };

    const handleCancel = () => {
        setDraft({
            username, learningGoal
        });
        setIsEditing(false);
    }

    const initials = (username ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

    if (!isProfileLoaded) {
        return <ProfileSkeleton />;
    }

    return (
        <div className="quiz-page profile-page">
            <Sidebar />
            <main>
                <div className="profile-content">
                    <header className="profile-page-heading">
                        <div>
                            <h1>My profile</h1>
                            <p className="profile-heading-copy">Your learning journey, all in one place.</p>
                        </div>
                    </header>

                    <section className="profile-hero" aria-label="Profile summary">
                        <div className="profile-avatar" style={{backgroundColor: avaColor}} aria-label={`${username} avatar`}>{initials}</div>
                        <div className="profile-identity">
                            <div className="profile-name-line">
                                <h2>{username}</h2>
                            </div>
                            <p>@{email || username?.toLowerCase().replace(/\s+/g, "")}</p>
                            <div className="profile-meta">
                                <span><ProfileIcon name="calendar" />Joined {formatDate}</span>
                            </div>
                        </div>
                    </section>

                    <section className="profile-statistics" aria-labelledby="statistics-title">
                        <h2 id="statistics-title" className="profile-statistics-title"><ProfileIcon name="award" />Statistics</h2>
                        <div className="profile-stats" aria-label="Learning statistics">
                            <article className="profile-stat-card">
                                <span className="profile-stat-icon profile-stat-icon-purple"><ProfileIcon name="code" /></span>
                                <div><strong>24</strong><span>Lesson completed</span></div>
                                <small>+4 this week</small>
                            </article>
                            <article className="profile-stat-card">
                                <span className="profile-stat-icon profile-stat-icon-orange"><ProfileIcon name="flame" /></span>
                                <div><strong>7 days</strong><span>Current streak</span></div>
                                <small>Personal best: 12</small>
                            </article>
                            <article className="profile-stat-card">
                                <span className="profile-stat-icon profile-stat-icon-green"><ProfileIcon name="check" /></span>
                                <div><strong>86%</strong><span>Average accuracy</span></div>
                                <small>Looking sharp!</small>
                            </article>
                            <article className="profile-stat-card">
                                <span className="profile-stat-icon profile-stat-icon-purple"><ProfileIcon name="award" /></span>
                                <div><strong>1,240 XP</strong><span>Total experience</span></div>
                                <small>+120 this week</small>
                            </article>
                        </div>
                    </section>

                    <div className="profile-details-grid">
                        <section className="profile-panel profile-activity-panel" aria-labelledby="activity-title">
                            <div className="activity-heading" id="activity-title">
                                <span className="activity-heading-icon"><ProfileIcon name="flame" /></span>
                                <h2>This week</h2>
                            </div>
                            <div className="activity-streak-status">
                                <svg className="activity-streak-flame" viewBox="0 0 547 624" aria-hidden="true">
                                    <path fill="#FF7504" fillRule="evenodd" clipRule="evenodd" d="M219.095 23.8317C212.459 64.1343 205.4 86.4878 190.467 114.633C170.255 152.704 143.015 186.52 102.712 223.565C44.8828 276.689 14.8066 323.839 2.89081 380.1C-0.668852 396.963 -1.00068 431.474 2.22715 448.88C13.8112 511.295 57.402 566.56 119.485 597.602C146.243 610.965 167.45 617.24 200.09 621.403C210.558 622.761 219.518 623.847 219.97 623.847C220.453 623.847 217.044 621.313 212.459 618.236C202.142 611.327 184.585 594.525 176.681 584.057C151.431 550.542 143.648 506.83 156.288 469.393C165.58 441.791 185.188 413.585 210.92 390.87C229.985 374.037 249.021 360.703 287.996 336.871L292.431 334.186L299.972 356.842C311.798 392.348 314.965 398.532 336.564 427.763C343.925 437.718 352.523 450.117 355.66 455.336C371.709 482.033 377.259 513.346 370.592 539.561C361.693 574.645 341.964 604.51 317.348 620.106C310.319 624.601 309.987 624.571 336.625 621.403C382.448 615.973 415.179 606.772 444.682 591.055C481.455 571.477 507.549 544.327 524.925 507.584C535.182 485.925 541.275 463.782 545.046 434.4C547.309 416.994 546.947 376.058 544.413 361.457C535.574 310.234 513.492 260.006 474.728 202.72C456.356 175.63 439.101 154.845 412.584 127.937L388.24 103.23L377.561 124.618C371.678 136.383 366.58 146.007 366.188 146.007C365.796 146.007 364.227 142.869 362.689 139.068C347.364 100.877 317.107 62.445 281.661 36.1698C274.119 30.589 224.827 0 223.379 0C223.198 0 221.267 10.7393 219.095 23.8317Z" />
                                </svg>
                                <div className="activity-streak-copy">
                                    <strong>{currentStreakDays}</strong>
                                    <span>day streak!</span>
                                    <p>{currentStreakDays ? `You're on a roll! Finish a lesson today to make it ${currentStreakDays + 1}.` : "Start a streak with a lesson today."}</p>
                                </div>
                            </div>
                            <div className="activity-week" aria-label={`${completedActivityDays} learning days this week`}>
                                {activity.map(({ day, completed, today }) => (
                                    <div className="activity-day-container" key={day}>
                                        <span
                                            className={`activity-day-marker${completed ? " is-complete" : ""}${today ? " is-today" : ""}`}
                                            role="img"
                                            aria-label={`${day}: ${completed ? "learning completed" : "no learning activity"}`}
                                        >
                                            {completed && <ProfileIcon name="check" />}
                                        </span>
                                        <span className="activity-day-name">{day[0]}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="activity-goal">
                                <div className="activity-goal-labels">
                                    <span><strong>{completedActivityDays} of {weeklyGoal}</strong> learning days</span>
                                    <span>{Math.round((completedActivityDays / weeklyGoal) * 100)}%</span>
                                </div>
                                <div className="activity-goal-track" role="progressbar" aria-label="Weekly learning days goal" aria-valuemin={0} aria-valuemax={weeklyGoal} aria-valuenow={completedActivityDays}>
                                    <span style={{ width: `${Math.min((completedActivityDays / weeklyGoal) * 100, 100)}%` }} />
                                </div>
                                <p>{completedActivityDays} active {completedActivityDays === 1 ? "day" : "days"} · Goal: 7 days per week</p>
                            </div>
                        </section>

                        <section className="profile-panel profile-about-panel" aria-labelledby="about-title">
                            <div className="profile-panel-heading">
                                <div>
                                    <span className="profile-section-title">
                                        <span className="profile-section-title-icon"><ProfileIcon name={"user-shield"} /></span>
                                        <h2 id="about-title">Profile details</h2>
                                    </span>
                                </div>
                                {!isEditing && <button type="button" className="profile-icon-button" aria-label="Edit profile details" onClick={() => setIsEditing(true)}><ProfileIcon name="edit" /></button>}
                            </div>
                            {isEditing ? (
                                <form className="profile-details-form" onSubmit={handleSave}>
                                    <label className="profile-details-input-group">
                                        <span className="profile-details-field-icon" aria-hidden="true"><ProfileIcon name="user" /></span>
                                        <input 
                                            id="username" 
                                            type="text" 
                                            placeholder="Display Name" 
                                            autoComplete="name" 
                                            required 
                                            defaultValue={draft?.username || username || ""} 
                                            onChange={(e) => setDraft({ ...draft, username: e.target.value })} 
                                        />
                                        <span className="profile-details-floating-label">Display name</span>
                                    </label>
                                    <label className="profile-details-input-group">
                                        <span className="profile-details-field-icon" aria-hidden="true"><ProfileIcon name="mail" /></span>
                                        <input
                                            id="email" 
                                            type="email" 
                                            placeholder="Email address" 
                                            autoComplete="email" 
                                            defaultValue={ email }
                                            disabled
                                        />
                                        <span className="profile-details-floating-label">Email address</span>
                                    </label>
                                    <label className="profile-details-input-group">
                                        <span className="profile-details-field-icon" aria-hidden="true"><ProfileIcon name="target" /></span>
                                        <input 
                                            id="learning-goal" 
                                            type="text" 
                                            placeholder="Learning goal" 
                                            defaultValue={draft?.learningGoal || learningGoal || ""}
                                            onChange={(e) => setDraft({ ...draft, learningGoal: e.target.value })}
                                        />
                                        <span className="profile-details-floating-label">Learning goal</span>
                                    </label>
                                    <div className="profile-form-actions">
                                        <button 
                                            className="profile-save-button"
                                            type="button"
                                            onClick={handleSave}
                                        >Save changes</button>
                                        <button 
                                            className="profile-cancel-button" 
                                            type="button" 
                                            onClick={handleCancel}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <dl className="profile-details-list">
                                        <div><dt>Display name</dt><dd>{username}</dd></div>
                                        <div><dt>Email</dt><dd>{email}</dd></div>
                                        <div><dt>Learning goal</dt><dd>{learningGoal}</dd></div>
                                    </dl>
                                    {saveMessage && <p className="profile-save-message" role="status">{saveMessage}</p>}
                                </>
                            )}
                        </section>

                    </div>
                </div>
            </main>
        </div>
    );
}
