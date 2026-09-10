"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LearnerProfile, CurriculumNode, LeaderboardEntry } from "@/app/actions/player";
import { getCurriculumMap, refillHearts } from "@/app/actions/player";

interface DashboardClientProps {
    initialProfile: LearnerProfile;
    initialCurriculum: CurriculumNode[];
    leaderboard: LeaderboardEntry[];
    isAdmin: boolean;
}

const COURSES = [
    { id: "HTML", name: "HTML5", icon: "🌐", themeClass: "" },
    { id: "CSS", name: "CSS3", icon: "🎨", themeClass: "css-theme" },
    { id: "JavaScript", name: "JavaScript", icon: "⚡", themeClass: "js-theme" },
];

export default function DashboardClient({
    initialProfile,
    initialCurriculum,
    leaderboard,
    isAdmin,
}: DashboardClientProps) {
    const router = useRouter();
    const [selectedCourse, setSelectedCourse] = useState("HTML");
    const [curriculum, setCurriculum] = useState<CurriculumNode[]>(initialCurriculum);
    const [profile, setProfile] = useState<LearnerProfile>(initialProfile);
    const [, startTransition] = useTransition();
    const [refillMessage, setRefillMessage] = useState<string | null>(null);
    const [isRefilling, setIsRefilling] = useState(false);
    const [claimedChests, setClaimedChests] = useState<Record<number, boolean>>({});

    // Group curriculum nodes by section
    const sections = React.useMemo(() => {
        const secMap = new Map<number, CurriculumNode[]>();
        for (const node of curriculum) {
            const list = secMap.get(node.secNum) || [];
            list.push(node);
            secMap.set(node.secNum, list);
        }
        return Array.from(secMap.entries()).sort((a, b) => a[0] - b[0]);
    }, [curriculum]);

    // Handle course tab switch
    const handleCourseChange = (courseId: string) => {
        if (courseId === selectedCourse) return;
        setSelectedCourse(courseId);
        startTransition(async () => {
            const nodes = await getCurriculumMap(courseId);
            setCurriculum(nodes);
        });
    };

    // Handle heart refill
    const handleRefillHearts = async () => {
        if (profile.hearts >= 5) {
            setRefillMessage("Hearts are already full!");
            setTimeout(() => setRefillMessage(null), 3000);
            return;
        }
        if (profile.gems < 20) {
            setRefillMessage("Not enough gems (20 gems required). Complete quizzes to earn gems!");
            setTimeout(() => setRefillMessage(null), 3000);
            return;
        }

        setIsRefilling(true);
        const res = await refillHearts();
        setIsRefilling(false);

        if (res.success) {
            setProfile((prev) => ({
                ...prev,
                hearts: 5,
                gems: Math.max(0, prev.gems - 20),
            }));
            setRefillMessage("Hearts fully refilled! ❤️");
        } else {
            setRefillMessage(res.error || "Failed to refill hearts.");
        }
        setTimeout(() => setRefillMessage(null), 3500);
    };

    // Claim chest bonus
    const handleClaimChest = (secNum: number) => {
        if (claimedChests[secNum]) return;
        setClaimedChests((prev) => ({ ...prev, [secNum]: true }));
        setProfile((prev) => ({
            ...prev,
            xp: prev.xp + 25,
            gems: prev.gems + 10,
        }));
        setRefillMessage(`🎁 Milestone Claimed! +25 XP & +10 Gems!`);
        setTimeout(() => setRefillMessage(null), 3500);
    };

    // Determine current level title
    const getLevelTitle = (lvl: number) => {
        if (lvl <= 1) return "Web Novice";
        if (lvl <= 3) return "HTML Apprentice";
        if (lvl <= 5) return "CSS Stylist";
        if (lvl <= 8) return "Script Virtuoso";
        if (lvl <= 12) return "Fullstack Architect";
        return "Grandmaster Coder";
    };

    // Determine the next active node purely
    const activeNodeId = React.useMemo(() => {
        for (const node of curriculum) {
            if (!profile.completedNodes[node.id]) {
                return node.id;
            }
        }
        return null;
    }, [curriculum, profile.completedNodes]);

    return (
        <div className="dashboard-container">
            {/* 1. TOP STICKY HUD */}
            <header className="dashboard-hud">
                <div className="hud-left">
                    <Link href="/" className="brand-logo">
                        <span style={{ fontSize: "1.6rem" }}>⚡</span>
                        <span>QuizWeb</span>
                    </Link>

                    {/* Course Switcher Pills */}
                    <div className="course-tabs" role="tablist" aria-label="Course selector">
                        {COURSES.map((course) => (
                            <button
                                key={course.id}
                                type="button"
                                role="tab"
                                aria-selected={selectedCourse === course.id}
                                className={`course-tab-btn ${selectedCourse === course.id ? "active" : ""}`}
                                onClick={() => handleCourseChange(course.id)}
                            >
                                <span>{course.icon}</span>
                                <span>{course.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="hud-right">
                    {/* Streak Flame */}
                    <div className="hud-stat-pill streak-pill" title={`${profile.currentStreak} day learning streak`}>
                        <span style={{ fontSize: "1.2rem" }}>🔥</span>
                        <span>{profile.currentStreak}</span>
                    </div>

                    {/* Gems */}
                    <div className="hud-stat-pill gems-pill" title={`${profile.gems} Gems available`}>
                        <span style={{ fontSize: "1.2rem" }}>💎</span>
                        <span>{profile.gems}</span>
                    </div>

                    {/* Hearts / Lives */}
                    <button
                        type="button"
                        className="hud-stat-pill hearts-pill"
                        onClick={handleRefillHearts}
                        disabled={isRefilling}
                        title="Click to refill hearts (Costs 20 Gems)"
                        style={{ border: "none", cursor: "pointer" }}
                    >
                        <span style={{ fontSize: "1.2rem" }}>❤️</span>
                        <span>{profile.hearts}/5</span>
                    </button>

                    {/* User profile / avatar */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "8px" }}>
                        <div
                            style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "50%",
                                backgroundColor: "var(--settings-primary, #7c3aed)",
                                color: "#ffffff",
                                fontWeight: "800",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1rem",
                            }}
                        >
                            {profile.username.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>
            </header>

            {/* Notification Banner */}
            {refillMessage && (
                <div
                    style={{
                        position: "fixed",
                        top: "76px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 100,
                        backgroundColor: "#1e293b",
                        color: "#ffffff",
                        padding: "10px 24px",
                        borderRadius: "999px",
                        fontWeight: "700",
                        fontSize: "0.95rem",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                        animation: "bounceFloat 0.3s ease",
                    }}
                >
                    {refillMessage}
                </div>
            )}

            {/* 2. MAIN LAYOUT: SNAKE MAP & SIDEBAR */}
            <main className="dashboard-main-layout">
                {/* LEFT: THE DUOLINGO LEARNING PATH */}
                <div className="learning-path-column">
                    {sections.map(([secNum, nodes]) => {
                        const firstNode = nodes[0];
                        const unitTitle = firstNode?.unitTitle || `Unit ${secNum}`;
                        const unitDesc = firstNode?.unitDescription || "Master these concepts to advance.";
                        const courseConfig = COURSES.find((c) => c.id === selectedCourse);

                        // Calculate completed nodes in this section
                        const completedCount = nodes.filter((n) => !!profile.completedNodes[n.id]).length;
                        const isUnitCompleted = completedCount === nodes.length && nodes.length > 0;

                        return (
                            <section key={secNum} className="unit-card" aria-label={unitTitle}>
                                {/* Unit Banner */}
                                <div className={`unit-banner ${courseConfig?.themeClass || ""}`}>
                                    <div className="unit-header-top">
                                        <span className="unit-tag">
                                            {selectedCourse} • Section {secNum}
                                        </span>
                                        <span style={{ fontSize: "0.85rem", fontWeight: "700", opacity: 0.9 }}>
                                            {completedCount} / {nodes.length} Checkpoints
                                        </span>
                                    </div>
                                    <h2 className="unit-title">{unitTitle}</h2>
                                    <p className="unit-desc">{unitDesc}</p>
                                </div>

                                {/* Snake Path Checkpoint Nodes */}
                                <div className="unit-nodes-container">
                                    {nodes.map((node, nodeIndex) => {
                                        const isCompleted = !!profile.completedNodes[node.id];
                                        const isActive = node.id === activeNodeId;
                                        const isLocked = !isCompleted && !isActive;

                                        // Winding alternating offsets
                                        const posPatterns = ["pos-center", "pos-right", "pos-center", "pos-left"];
                                        const posClass = posPatterns[nodeIndex % posPatterns.length];

                                        return (
                                            <div key={node.id} className={`node-wrapper ${posClass}`}>
                                                {/* Floating "START" Bubble for active node */}
                                                {isActive && <div className="active-bubble">START</div>}

                                                <button
                                                    type="button"
                                                    className={`node-btn ${
                                                        isCompleted ? "completed" : isActive ? "active" : "locked"
                                                    }`}
                                                    disabled={isLocked}
                                                    onClick={() => {
                                                        if (!isLocked) {
                                                            router.push(
                                                                `/quiz?cat=${node.catName}&sec=${node.secNum}&diff=${node.difficultyName}`
                                                            );
                                                        }
                                                    }}
                                                    title={`${node.difficultyName}: ${node.totalQuestions} Questions`}
                                                    aria-label={`${node.difficultyName} checkpoint in ${unitTitle}`}
                                                >
                                                    {isCompleted ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                    ) : isActive ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                                    )}
                                                </button>

                                                {/* Stars under completed node */}
                                                {isCompleted && (
                                                    <div className="node-stars">
                                                        <span>★</span><span>★</span><span>★</span>
                                                    </div>
                                                )}

                                                <span className="node-label">
                                                    {node.difficultyName}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {/* Milestone Chest at end of Section */}
                                    <div className="node-wrapper pos-center" style={{ marginTop: "12px" }}>
                                        <button
                                            type="button"
                                            className="chest-node"
                                            onClick={() => handleClaimChest(secNum)}
                                            disabled={!isUnitCompleted || claimedChests[secNum]}
                                            style={{
                                                opacity: isUnitCompleted ? 1 : 0.6,
                                                cursor: isUnitCompleted && !claimedChests[secNum] ? "pointer" : "default",
                                            }}
                                            title={
                                                claimedChests[secNum]
                                                    ? "Chest Claimed!"
                                                    : isUnitCompleted
                                                    ? "Click to claim Milestone Chest (+25 XP, +10 Gems)!"
                                                    : "Complete all checkpoints to unlock chest!"
                                            }
                                        >
                                            <span style={{ fontSize: "1.8rem" }}>
                                                {claimedChests[secNum] ? "✨" : "🎁"}
                                            </span>
                                        </button>
                                        <span className="node-label" style={{ fontWeight: "800", color: "#d97706" }}>
                                            {claimedChests[secNum] ? "Claimed" : "Bonus Chest"}
                                        </span>
                                    </div>
                                </div>
                            </section>
                        );
                    })}
                </div>

                {/* RIGHT: WIDGETS SIDEBAR */}
                <aside className="sidebar-column">
                    {/* Widget 1: Level & XP Stats */}
                    <div className="widget-card">
                        <div className="level-badge-row">
                            <div className="level-number-badge">{profile.level}</div>
                            <div className="level-meta">
                                <span className="level-name">{getLevelTitle(profile.level)}</span>
                                <span className="level-xp-sub">
                                    {profile.xp} Total XP earned
                                </span>
                            </div>
                        </div>

                        <div className="quest-desc" style={{ marginBottom: "6px" }}>
                            <span>Progress to Level {profile.level + 1}</span>
                            <span>{profile.levelProgressPercent}%</span>
                        </div>
                        <div className="quest-progress-bar">
                            <div
                                className="quest-progress-fill"
                                style={{
                                    width: `${profile.levelProgressPercent}%`,
                                    backgroundColor: "var(--settings-primary, #7c3aed)",
                                }}
                            />
                        </div>
                    </div>

                    {/* Widget 2: Daily Quests */}
                    <div className="widget-card">
                        <div className="widget-header">
                            <h3 className="widget-title">
                                <span>🎯</span>
                                <span>Daily Quests</span>
                            </h3>
                            <span style={{ fontSize: "0.8rem", color: "var(--settings-text-muted)", fontWeight: "600" }}>
                                Resets in 18h
                            </span>
                        </div>

                        <div className="quest-item">
                            <div className="quest-desc">
                                <span>Earn 30 XP Today</span>
                                <span style={{ color: "#eab308", fontWeight: "700" }}>+10 💎</span>
                            </div>
                            <div className="quest-progress-bar">
                                <div
                                    className="quest-progress-fill"
                                    style={{
                                        width: `${Math.min(100, Math.round((profile.xp % 100 / 30) * 100))}%`,
                                        backgroundColor: "#eab308",
                                    }}
                                />
                            </div>
                        </div>

                        <div className="quest-item">
                            <div className="quest-desc">
                                <span>Maintain Streak (Day {profile.currentStreak})</span>
                                <span style={{ color: "#ea580c", fontWeight: "700" }}>+20 XP</span>
                            </div>
                            <div className="quest-progress-bar">
                                <div
                                    className="quest-progress-fill"
                                    style={{
                                        width: profile.currentStreak > 0 ? "100%" : "0%",
                                        backgroundColor: "#ea580c",
                                    }}
                                />
                            </div>
                        </div>

                        <div className="quest-item">
                            <div className="quest-desc">
                                <span>Solve a Coding Problem</span>
                                <span style={{ color: "#10b981", fontWeight: "700" }}>+15 XP</span>
                            </div>
                            <div className="quest-progress-bar">
                                <div
                                    className="quest-progress-fill"
                                    style={{
                                        width: "0%",
                                        backgroundColor: "#10b981",
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Widget 3: Weekly Leaderboard / League */}
                    <div className="widget-card">
                        <div className="widget-header">
                            <h3 className="widget-title">
                                <span>🏆</span>
                                <span>Bronze League</span>
                            </h3>
                            <span style={{ fontSize: "0.8rem", color: "var(--settings-text-muted)", fontWeight: "700" }}>
                                Top 10
                            </span>
                        </div>

                        <div className="leaderboard-list">
                            {leaderboard.map((player) => {
                                const isUser = player.userId === profile.userId;
                                let medal = `${player.rank}`;
                                if (player.rank === 1) medal = "🥇";
                                else if (player.rank === 2) medal = "🥈";
                                else if (player.rank === 3) medal = "🥉";

                                return (
                                    <div
                                        key={player.userId}
                                        className={`leaderboard-row ${isUser ? "current-user" : ""}`}
                                    >
                                        <div className="leaderboard-rank">
                                            <span className="rank-badge">{medal}</span>
                                            <span>{player.username} {isUser && "(You)"}</span>
                                        </div>
                                        <div style={{ fontWeight: "700", color: "var(--settings-primary, #7c3aed)" }}>
                                            {player.xp} XP
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Widget 4: Admin Controls (if admin) */}
                    {isAdmin && (
                        <div className="widget-card" style={{ borderColor: "#7c3aed" }}>
                            <div className="widget-header">
                                <h3 className="widget-title" style={{ color: "#7c3aed" }}>
                                    <span>⚙️</span>
                                    <span>Admin Panel</span>
                                </h3>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <Link
                                    href="/input"
                                    style={{
                                        display: "block",
                                        padding: "10px 14px",
                                        borderRadius: "12px",
                                        backgroundColor: "rgba(124, 58, 237, 0.08)",
                                        color: "#7c3aed",
                                        textDecoration: "none",
                                        fontWeight: "700",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    + Add New Quiz Questions
                                </Link>
                                <Link
                                    href="/pending"
                                    style={{
                                        display: "block",
                                        padding: "10px 14px",
                                        borderRadius: "12px",
                                        backgroundColor: "rgba(124, 58, 237, 0.08)",
                                        color: "#7c3aed",
                                        textDecoration: "none",
                                        fontWeight: "700",
                                        fontSize: "0.9rem",
                                    }}
                                >
                                    Review Pending Questions
                                </Link>
                            </div>
                        </div>
                    )}
                </aside>
            </main>
        </div>
    );
}
