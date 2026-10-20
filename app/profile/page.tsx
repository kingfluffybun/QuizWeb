"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Sidebar from "@/app/components/Sidebar";
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

type ProfileDetails = {
    displayName: string;
    email: string;
    learningGoal: string;
};

const defaultProfile: ProfileDetails = {
    displayName: "Juan DelaCruz",
    email: "juan.delacruz@example.com",
    learningGoal: "Build my first website",
};

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
const passwordRules = [
    { label: "8+ characters", test: (password: string) => password.length >= 8 },
    { label: "24 max characters", test: (password: string) => password.length <= 24 },
    { label: "uppercase", test: (password: string) => /[A-Z]/.test(password) },
    { label: "lowercase", test: (password: string) => /[a-z]/.test(password) },
    { label: "number", test: (password: string) => /[0-9]/.test(password) },
    { label: "symbol", test: (password: string) => /[!@#$%^&*]/.test(password) },
];
const passwordStrengthColors = ["#333333", "#e5484d", "#e5484d", "#f5a623", "#f5c518", "#8bc34a", "#34c759"];

export default function ProfilePage() {
    const [profile, setProfile] = useState<ProfileDetails>(defaultProfile);
    const [draft, setDraft] = useState<ProfileDetails>(defaultProfile);
    const [isEditing, setIsEditing] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState("");
    const [newPassword, setNewPassword] = useState("");

    useEffect(() => {
        try {
            const savedProfile = localStorage.getItem("quizweb-profile-details");
            if (!savedProfile) return;
            const parsedProfile = JSON.parse(savedProfile) as Partial<ProfileDetails>;
            const loadedProfile = { ...defaultProfile, ...parsedProfile };
            setProfile(loadedProfile);
            setDraft(loadedProfile);
        } catch {
            localStorage.removeItem("quizweb-profile-details");
        }
    }, []);

    const handleSave = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const savedProfile = {
            displayName: draft.displayName.trim() || defaultProfile.displayName,
            email: draft.email.trim(),
            learningGoal: draft.learningGoal.trim(),
        };  
        setProfile(savedProfile);
        setDraft(savedProfile);
        localStorage.setItem("quizweb-profile-details", JSON.stringify(savedProfile));
        setIsEditing(false);
        setSaveMessage("Profile details saved.");
    };

    const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const currentPasswordValue = String(formData.get("currentPassword") ?? "");
        const newPasswordValue = String(formData.get("newPassword") ?? "");
        const confirmPasswordValue = String(formData.get("confirmPassword") ?? "");

        if (!currentPasswordValue || !newPasswordValue || !confirmPasswordValue) {
            setPasswordMessage("Please complete all password fields.");
            return;
        }

        if (!passwordRules.every((rule) => rule.test(newPasswordValue))) {
            setPasswordMessage("Please meet all password requirements before saving.");
            return;
        }

        if (newPasswordValue !== confirmPasswordValue) {
            setPasswordMessage("New password and confirmation do not match.");
            return;
        }

        setPasswordMessage("Your passwords meet the requirements, but password updates are not connected yet.");
    };

    const cancelPasswordChange = () => {
        setIsChangingPassword(false);
        setPasswordMessage("");
        setNewPassword("");
    };

    const passedPasswordRules = passwordRules.filter((rule) => rule.test(newPassword)).length;
    const missingPasswordRules = passwordRules.filter((rule) => !rule.test(newPassword)).map((rule) => rule.label);
    const passwordRulesPassed = passedPasswordRules === passwordRules.length;

    const initials = profile.displayName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

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
                        <div className="profile-avatar" aria-label={`${profile.displayName} avatar`}>{initials}</div>
                        <div className="profile-identity">
                            <div className="profile-name-line">
                                <h2>{profile.displayName}</h2>
                            </div>
                            <p>@{profile.displayName.toLowerCase().replace(/\s+/g, "")}</p>
                            <div className="profile-meta">
                                <span><ProfileIcon name="calendar" /> Joined October 2026</span>
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
                                        <span className="profile-section-title-icon"><ProfileIcon name={isChangingPassword ? "user-shield" : "user-pen"} /></span>
                                        <h2 id="about-title">{isChangingPassword ? "Change password" : "Profile details"}</h2>
                                    </span>
                                </div>
                                {!isChangingPassword && !isEditing && <button type="button" className="profile-icon-button" aria-label="Edit profile details" onClick={() => { setDraft(profile); setIsEditing(true); setSaveMessage(""); }}><ProfileIcon name="edit" /></button>}
                            </div>
                            {isChangingPassword ? (
                                <form className="profile-password-form" noValidate onSubmit={handlePasswordSubmit}>
                                    <div className="profile-password-field">
                                        <label className="profile-password-input-group">
                                            <span className="profile-password-field-icon" aria-hidden="true"><ProfileIcon name="lock" /></span>
                                            <input id="profile-current-password" name="currentPassword" type="password" placeholder=" " autoComplete="current-password" onChange={() => setPasswordMessage("")} />
                                            <span className="profile-password-floating-label">Current password</span>
                                        </label>
                                    </div>
                                    <div className="profile-password-field">
                                        <label className="profile-password-input-group">
                                            <span className="profile-password-field-icon" aria-hidden="true"><ProfileIcon name="lock" /></span>
                                            <input id="profile-new-password" name="newPassword" type="password" placeholder=" " autoComplete="new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setPasswordMessage(""); }} />
                                            <span className="profile-password-floating-label">New password</span>
                                        </label>
                                    </div>
                                    <div className="profile-password-field">
                                        <label className="profile-password-input-group">
                                            <span className="profile-password-field-icon" aria-hidden="true"><ProfileIcon name="lock" /></span>
                                            <input id="profile-confirm-password" name="confirmPassword" type="password" placeholder=" " autoComplete="new-password" onChange={() => setPasswordMessage("")} />
                                            <span className="profile-password-floating-label">Confirm new password</span>
                                        </label>
                                    </div>
                                    {newPassword.length > 0 && (
                                        <div className="profile-password-strength" aria-live="polite">
                                            <p className={`profile-password-strength-hint${passwordRulesPassed ? " is-good" : ""}`}>
                                                {passwordRulesPassed ? "Strong password" : `Needs: ${missingPasswordRules.join(", ")}`}
                                            </p>
                                            <div className="profile-password-strength-track" aria-label={`${passedPasswordRules} of ${passwordRules.length} password requirements met`}>
                                                {passwordRules.map((rule, index) => (
                                                    <span
                                                        key={rule.label}
                                                        className="profile-password-strength-segment"
                                                        style={{ backgroundColor: index < passedPasswordRules ? passwordStrengthColors[passedPasswordRules] : undefined }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {passwordMessage && <p className="profile-password-message" role="status">{passwordMessage}</p>}
                                    <div className="profile-form-actions">
                                        <button className="profile-save-button" type="submit">Save Changes</button>
                                        <button className="profile-cancel-button" type="button" onClick={cancelPasswordChange}>Cancel</button>
                                    </div>
                                </form>
                            ) : isEditing ? (
                                <form className="profile-details-form" onSubmit={handleSave}>
                                    <label className="profile-details-input-group">
                                        <span className="profile-details-field-icon" aria-hidden="true"><ProfileIcon name="user" /></span>
                                        <input id="profile-display-name" placeholder=" " autoComplete="name" required value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} />
                                        <span className="profile-details-floating-label">Display name</span>
                                    </label>
                                    <label className="profile-details-input-group">
                                        <span className="profile-details-field-icon" aria-hidden="true"><ProfileIcon name="mail" /></span>
                                        <input id="profile-email" type="email" placeholder=" " autoComplete="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
                                        <span className="profile-details-floating-label">Email address</span>
                                    </label>
                                    <label className="profile-details-input-group">
                                        <span className="profile-details-field-icon" aria-hidden="true"><ProfileIcon name="target" /></span>
                                        <input id="profile-learning-goal" placeholder=" " value={draft.learningGoal} onChange={(event) => setDraft({ ...draft, learningGoal: event.target.value })} />
                                        <span className="profile-details-floating-label">Learning goal</span>
                                    </label>
                                    <div className="profile-form-actions">
                                        <button className="profile-save-button" type="submit">Save changes</button>
                                        <button className="profile-cancel-button" type="button" onClick={() => { setDraft(profile); setIsEditing(false); }}>Cancel</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <dl className="profile-details-list">
                                        <div><dt>Display name</dt><dd>{profile.displayName}</dd></div>
                                        <div><dt>Email</dt><dd>{profile.email || "Not provided"}</dd></div>
                                        <div><dt>Learning goal</dt><dd>{profile.learningGoal || "Not set"}</dd></div>
                                    </dl>
                                    {saveMessage && <p className="profile-save-message" role="status">{saveMessage}</p>}
                                    <div className="profile-password-section">
                                        <button className="profile-password-toggle" type="button" onClick={() => { setIsChangingPassword(true); setPasswordMessage(""); }}>
                                            Change password
                                        </button>
                                    </div>
                                </>
                            )}
                        </section>

                    </div>
                </div>
            </main>
        </div>
    );
}
