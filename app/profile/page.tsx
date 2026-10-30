"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { UserInfoResponse } from "@/app/api/db/user-info/route";
import { getUserStreakData, type StreakData } from "@/app/actions/streak";
import { getClientLocalDate, getServerLocalDate, subscribeClientDate } from "@/lib/timezone";
import Sidebar from "@/app/components/Sidebar";
import ProfileSkeleton from "@/app/components/skeletons/ProfileSkeleton";
import "#css/profile.css";
import "#css/quiz.css";
import "#css/sidebar.css";

type ProfileIconName = "calendar" | "award" | "target" | "flame" | "check" | "code" | "user-shield" | "edit" | "user" | "mail";

function ProfileIcon({ name }: { name: ProfileIconName }) {
    const icons: Record<ProfileIconName, ReactNode> = {
        calendar: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>,
        award: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>,
        target: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
        flame: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>,
        check: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>,
        code: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
        "user-shield": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>,
        edit: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
        user: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
        mail: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>,
    };
    return icons[name] ?? null;
}

const weeklyGoal = 7;
const learningGoalOptions = [
    { label: "Basic", value: 50 },
    { label: "Casual", value: 100 },
    { label: "Regular", value: 200 },
    { label: "Serious", value: 300 },
    { label: "Intense", value: 500 },
];

export default function ProfilePage() {
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);
    const [streakData, setStreakData] = useState<StreakData | null>(null);
    const [username, setUsername] = useState<string | undefined>();
    const [email, setEmail] = useState<string | undefined>();
    const [avaColor, setAvaColor] = useState<string | undefined>();
    const [learningGoal, setLearningGoal] = useState<number | undefined>();
    const [createdDate, setCreatedDate] = useState<string>();
    const [profileStatistics, setProfileStatistics] = useState<{
        lessonsCompleted: number;
        lessonsCompletedThisWeek: number;
        totalXp: number;
        xpEarnedThisWeek: number;
    } | null>(null);

    const clientToday = useSyncExternalStore(subscribeClientDate, getClientLocalDate, getServerLocalDate);

    useEffect(() => {
        let isMounted = true;
        getUserStreakData(undefined, undefined, clientToday ?? undefined)
            .then((data) => {
                if (isMounted) setStreakData(data);
            })
            .catch((err: unknown) => {
                console.error("Failed to load streak data:", err);
            });
        return () => {
            isMounted = false;
        };
    }, [clientToday]);

    const [draft, setDraft] = useState<{ username?: string; email?: string; learningGoal?: number }>({
        username: undefined,
        learningGoal: undefined
    });

    const [isEditing, setIsEditing] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");

    useEffect(() => {
        let isMounted = true;
        fetch("/api/db/user-info")
            .then(async (res) => {
                const json = await res.json();
                if (!isMounted || !res.ok) return;
                if (Object.keys(json).length === 0) return;
                
                const loadedUser: UserInfoResponse | undefined = json as UserInfoResponse | undefined;

                const numericGoal = loadedUser?.learning_goal != null ? Number(loadedUser.learning_goal) : (loadedUser?.daily_xp_goal != null ? Number(loadedUser.daily_xp_goal) : undefined);

                setUsername(loadedUser?.username);
                setEmail(loadedUser?.email);
                setAvaColor(loadedUser?.avatar_color);
                setCreatedDate(loadedUser?.created_at);
                setLearningGoal(numericGoal);
                setProfileStatistics({
                    lessonsCompleted: Number(loadedUser?.lessons_completed ?? 0),
                    lessonsCompletedThisWeek: Number(loadedUser?.lessons_completed_this_week ?? 0),
                    totalXp: Number(loadedUser?.xp ?? 0),
                    xpEarnedThisWeek: Number(loadedUser?.xp_earned_this_week ?? 0),
                });
                setDraft({
                    username: loadedUser?.username,
                    learningGoal: numericGoal
                });
                setIsProfileLoaded(true);
            })
            .catch((err) => {
                console.error("API Fetch encountered an error:", err);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const currentStreakDays = streakData?.currentStreak ?? 0;
    const longestStreakDays = streakData?.longestStreak ?? 0;
    const completedActivityDays =
        streakData?.weekDays.filter(({ isActive }) => isActive).length ?? 0;
    const streakMessage = streakData?.todayCompleted
        ? "You're on a roll! Streak maintained for today!"
        : currentStreakDays > 0
            ? `You're on a roll! Finish a lesson today to make it ${currentStreakDays + 1}.`
            : "Complete a lesson or quiz today to start your streak!";

    const oldDate = createdDate ? new Date(createdDate) : null;
    const formatDate = oldDate && !isNaN(oldDate.getTime())
        ? oldDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : "Recently";

    const handleSave = async () => {
        try {
            const usernameValue = draft?.username || username;
            const emailValue = draft?.email || email;
            const learningGoalValue = draft?.learningGoal ?? learningGoal;

            const numericGoal = learningGoalValue != null ? Number(learningGoalValue) : undefined;
            const payload = {
                username: (usernameValue || "").trim(),
                learning_goal: numericGoal,
                daily_xp_goal: numericGoal,
            };

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

            const returnedGoal = result.learning_goal != null ? Number(result.learning_goal) : (result.daily_xp_goal != null ? Number(result.daily_xp_goal) : undefined);
            setUsername(result.username);
            setEmail(emailValue);
            setLearningGoal(returnedGoal);

            setDraft({
                username: result.username,
                email: result.email,
                learningGoal: returnedGoal
            });

            setSaveMessage("Profile updated successfully!");

            setIsEditing(false);
        } catch (error: unknown) {
            let errorMessage = "Failed to save changes. Please try again.";

            if (error instanceof Error && error.message.includes('fetch')) {
                errorMessage = "Network error - cannot connect to server.";
            }

            alert(errorMessage);
            setSaveMessage(errorMessage);
        }
    };

    const handleCancel = () => {
        setDraft({
            username: username,
            learningGoal: learningGoal
        });
        setIsEditing(false);
        setSaveMessage("");
    };

    const initials = (username || "Player")
        .split(" ")
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
                    <section className="profile-header" aria-label="Profile summary">
                        <div className="profile-hero">
                            <div className="profile-avatar" style={{backgroundColor: avaColor}} aria-label={`${username} avatar`}>{initials}</div>
                        </div>
                        <div className="profile-details">
                            <div className="profile-identity">
                                <div className="profile-name-line">
                                    <h1>{username}</h1>
                                </div>
                                <p>@{email || username?.toLowerCase().replace(/\s+/g, "")}</p>
                                <div className="profile-meta">
                                    <small><ProfileIcon name="calendar" />Joined {formatDate}</small>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="profile-statistics" aria-labelledby="statistics-title">
                        <h2 id="statistics-title" className="profile-statistics-title"><ProfileIcon name="award" />Statistics</h2>
                        <div className="profile-stats" aria-label="Learning statistics">
                            <article className="profile-stat-card">
                                <div className="profile-stat-main">
                                    <span className="profile-stat-icon profile-stat-icon-purple"><ProfileIcon name="code" /></span>
                                    <div><strong>{profileStatistics?.lessonsCompleted.toLocaleString() ?? "—"}</strong><span>Lessons completed</span></div>
                                </div>
                                <small>+{profileStatistics?.lessonsCompletedThisWeek.toLocaleString() ?? "—"} this week</small>
                            </article>
                            <article className="profile-stat-card">
                                <div className="profile-stat-main">
                                    <span className="profile-stat-icon profile-stat-icon-orange"><ProfileIcon name="flame" /></span>
                                    <div><strong>{currentStreakDays} days</strong><span>Current streak</span></div>
                                </div>
                                <small>Personal best: {longestStreakDays} days</small>
                            </article>
                            <article className="profile-stat-card">
                                <div className="profile-stat-main">
                                    <span className="profile-stat-icon profile-stat-icon-green"><ProfileIcon name="check" /></span>
                                    <div><strong>{streakData?.totalActiveDays.toLocaleString() ?? "—"}</strong><span>Learning days</span></div>
                                </div>
                                <small>All-time active days</small>
                            </article>
                            <article className="profile-stat-card">
                                <div className="profile-stat-main">
                                    <span className="profile-stat-icon profile-stat-icon-purple"><ProfileIcon name="award" /></span>
                                    <div><strong>{profileStatistics?.totalXp.toLocaleString() ?? "—"} XP</strong><span>Total experience</span></div>
                                </div>
                                <small>+{profileStatistics?.xpEarnedThisWeek.toLocaleString() ?? "—"} this week</small>
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
                                    <path fill={currentStreakDays > 0 || (streakData?.todayCompleted ?? false) ? "#FF7504" : "var(--text-muted)"} fillRule="evenodd" clipRule="evenodd" d="M219.095 23.8317C212.459 64.1343 205.4 86.4878 190.467 114.633C170.255 152.704 143.015 186.52 102.712 223.565C44.8828 276.689 14.8066 323.839 2.89081 380.1C-0.668852 396.963 -1.00068 431.474 2.22715 448.88C13.8112 511.295 57.402 566.56 119.485 597.602C146.243 610.965 167.45 617.24 200.09 621.403C210.558 622.761 219.518 623.847 219.97 623.847C220.453 623.847 217.044 621.313 212.459 618.236C202.142 611.327 184.585 594.525 176.681 584.057C151.431 550.542 143.648 506.83 156.288 469.393C165.58 441.791 185.188 413.585 210.92 390.87C229.985 374.037 249.021 360.703 287.996 336.871L292.431 334.186L299.972 356.842C311.798 392.348 314.965 398.532 336.564 427.763C343.925 437.718 352.523 450.117 355.66 455.336C371.709 482.033 377.259 513.346 370.592 539.561C361.693 574.645 341.964 604.51 317.348 620.106C310.319 624.601 309.987 624.571 336.625 621.403C382.448 615.973 415.179 606.772 444.682 591.055C481.455 571.477 507.549 544.327 524.925 507.584C535.182 485.925 541.275 463.782 545.046 434.4C547.309 416.994 546.947 376.058 544.413 361.457C535.574 310.234 513.492 260.006 474.728 202.72C456.356 175.63 439.101 154.845 412.584 127.937L388.24 103.23L377.561 124.618C371.678 136.383 366.58 146.007 366.188 146.007C365.796 146.007 364.227 142.869 362.689 139.068C347.364 100.877 317.107 62.445 281.661 36.1698C274.119 30.589 224.827 0 223.379 0C223.198 0 221.267 10.7393 219.095 23.8317Z" />
                                </svg>
                                <div className="activity-streak-copy">
                                    <strong>{currentStreakDays}</strong>
                                    <span>day streak!</span>
                                    <p>{streakMessage}</p>
                                </div>
                            </div>
                            <div className="activity-week" aria-label={`${completedActivityDays} learning days this week`}>
                                {streakData?.weekDays.map((day) => (
                                    <div className="activity-day-container" key={day.date}>
                                        <span
                                            className={`activity-day-marker${day.isActive ? " is-complete" : ""}${day.isToday && !day.isActive ? " is-today" : ""}`}
                                            role="img"
                                            aria-label={`${day.dayName}: ${day.isActive ? "learning completed" : day.isToday ? "today, no activity yet" : "no learning activity"}`}
                                        >
                                            {day.isActive && (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="20"
                                                    height="20"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    aria-hidden="true"
                                                >
                                                    <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className="activity-day-name">{day.dayLetter}</span>
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
                                        <select
                                            id="learning-goal"
                                            value={learningGoalOptions.some(({value}) => value === (draft?.learningGoal ?? learningGoal))
                                                ? draft?.learningGoal ?? learningGoal ?? 50
                                                : 50}
                                            aria-label="Learning goal"
                                            onChange={(e) => setDraft({ ...draft, learningGoal: Number(e.target.value) })}
                                        >
                                            {learningGoalOptions.map(({label, value}) => (
                                                <option key={value} value={value}>{label} - {value} XP per day</option>
                                            ))}
                                        </select>
                                        <span className="profile-details-floating-label profile-details-floating-label--select">Learning goal</span>
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
                                        <div><dt>Learning goal</dt><dd>{learningGoal ? `${learningGoal} XP / day` : "50 XP / day"}</dd></div>
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
