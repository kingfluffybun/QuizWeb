"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LearnerProfile, CurriculumNode, LeaderboardEntry } from "@/app/actions/player";
import { refillHearts, claimMilestoneChest } from "@/app/actions/player";
import { GUIDEBOOK_DATA, type GuidebookSection } from "./guidebookData";
import { playPopSound, playClickSound, playVictoryChime } from "./duoAudio";

interface DashboardClientProps {
    initialProfile: LearnerProfile;
    initialCurriculum: CurriculumNode[];
    leaderboard: LeaderboardEntry[];
    isAdmin: boolean;
}

// Sinusoidal offsets for true Duolingo snake winding
const WINDING_OFFSETS = [
    "pos-center",   // 0: Center
    "pos-right-1",  // 1: Slightly right
    "pos-right-2",  // 2: Furthest right
    "pos-right-1",  // 3: Slightly right
    "pos-center",   // 4: Center
    "pos-left-1",   // 5: Slightly left
    "pos-left-2",   // 6: Furthest left
    "pos-left-1",   // 7: Slightly left
];

const OFFSET_VALUES: Record<string, number> = {
    "pos-center": 0,
    "pos-right-1": 42,
    "pos-right-2": 68,
    "pos-left-1": -42,
    "pos-left-2": -68,
};

function subscribeToStorage(callback: () => void) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("storage", callback);
    return () => window.removeEventListener("storage", callback);
}

export default function DashboardClient({
    initialProfile,
    initialCurriculum,
    leaderboard,
    isAdmin,
}: DashboardClientProps) {
    const router = useRouter();
    const [curriculum] = useState<CurriculumNode[]>(initialCurriculum);
    const [profile, setProfile] = useState<LearnerProfile>(initialProfile);
    const [refillMessage, setRefillMessage] = useState<string | null>(null);
    const [isRefilling, setIsRefilling] = useState(false);

    // Sync claimed chests from localStorage via useSyncExternalStore
    const storageKey = `quizweb_chests_${initialProfile.userId}`;
    const rawChests = React.useSyncExternalStore(
        subscribeToStorage,
        () => (typeof window !== "undefined" ? localStorage.getItem(storageKey) || "{}" : "{}"),
        () => "{}"
    );
    const claimedChests = React.useMemo<Record<number, boolean>>(() => {
        try {
            return JSON.parse(rawChests);
        } catch {
            return {};
        }
    }, [rawChests]);

    // Popover selection state
    const [selectedNode, setSelectedNode] = useState<CurriculumNode | null>(null);

    // Guidebook modal state
    const [guidebookModal, setGuidebookModal] = useState<{
        catName: string;
        secNum: number;
        section: GuidebookSection;
    } | null>(null);

    // Ref to active node for auto-scroll
    const activeNodeRef = useRef<HTMLDivElement | null>(null);

    // Group curriculum nodes by unified roadmap step (1 to 17)
    const roadmapSteps = React.useMemo(() => {
        const stepMap = new Map<number, CurriculumNode[]>();
        for (const node of curriculum) {
            const list = stepMap.get(node.stepIndex) || [];
            list.push(node);
            stepMap.set(node.stepIndex, list);
        }
        return Array.from(stepMap.entries()).sort((a, b) => a[0] - b[0]);
    }, [curriculum]);

    // Compute continuous layout information across all 17 sections (single unbroken snake road)
    const pathLayout = React.useMemo(() => {
        let index = 0;
        const nodeLayout = new Map<
            string,
            { globalIndex: number; posClass: string; offsetPx: number; nextPosClass?: string; nextOffsetPx?: number }
        >();
        const chestLayout = new Map<
            number,
            { globalIndex: number; posClass: string; offsetPx: number; nextPosClass?: string; nextOffsetPx?: number }
        >();

        type SequenceItem =
            | { type: "node"; node: CurriculumNode }
            | { type: "chest"; stepIndex: number };

        const sequence: SequenceItem[] = [];

        for (const [stepIndex, nodes] of roadmapSteps) {
            for (const node of nodes) {
                sequence.push({ type: "node", node });
            }
            sequence.push({ type: "chest", stepIndex });
        }

        for (let i = 0; i < sequence.length; i++) {
            const item = sequence[i];
            const globalIndex = index++;
            const posClass = WINDING_OFFSETS[globalIndex % WINDING_OFFSETS.length];
            const offsetPx = OFFSET_VALUES[posClass] ?? 0;

            const nextIndex = i + 1;
            const nextPosClass = nextIndex < sequence.length
                ? WINDING_OFFSETS[(globalIndex + 1) % WINDING_OFFSETS.length]
                : undefined;
            const nextOffsetPx = nextPosClass ? (OFFSET_VALUES[nextPosClass] ?? 0) : undefined;

            if (item.type === "node") {
                nodeLayout.set(item.node.id, { globalIndex, posClass, offsetPx, nextPosClass, nextOffsetPx });
            } else {
                chestLayout.set(item.stepIndex, { globalIndex, posClass, offsetPx, nextPosClass, nextOffsetPx });
            }
        }

        return { nodeLayout, chestLayout };
    }, [roadmapSteps]);

    // Determine the next active node in strict sequential order
    const activeNodeId = React.useMemo(() => {
        for (const node of curriculum) {
            if (!profile.completedNodes[node.id]) {
                return node.id;
            }
        }
        return null;
    }, [curriculum, profile.completedNodes]);

    // Smooth scroll to active node on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeNodeRef.current) {
                activeNodeRef.current.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            }
        }, 400);
        return () => clearTimeout(timer);
    }, []);

    // Dismiss popover on outside click
    useEffect(() => {
        const handleDocClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest(".node-wrapper") && !target.closest(".duo-popover")) {
                setSelectedNode(null);
            }
        };
        document.addEventListener("click", handleDocClick);
        return () => document.removeEventListener("click", handleDocClick);
    }, []);

    // Handle node stepping-stone click: Opens Duolingo popover!
    const handleNodeClick = (node: CurriculumNode) => {
        playPopSound();
        if (selectedNode?.id === node.id) {
            setSelectedNode(null);
        } else {
            setSelectedNode(node);
        }
    };

    // Open Guidebook
    const handleOpenGuidebook = (catName: string, secNum: number, unitTitle: string) => {
        playClickSound();
        const courseGuidebook = GUIDEBOOK_DATA[catName] || {};
        const sectionData = courseGuidebook[secNum] || {
            title: unitTitle,
            summary: `Key programming principles and patterns for ${catName} Section ${secNum}.`,
            keyPoints: [
                "Practice checkpoints regularly to maintain your daily streak.",
                "Review error messages and hints when you miss questions.",
                "Reinforce your skills by completing bonus practice challenges.",
            ],
            codeExample: `// Review the key syntax for ${catName} Section ${secNum}`,
        };

        setGuidebookModal({
            catName,
            secNum,
            section: sectionData,
        });
    };

    // Handle heart refill
    const handleRefillHearts = async () => {
        playClickSound();
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
            playVictoryChime();
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
    const handleClaimChest = async (stepIndex: number) => {
        if (claimedChests[stepIndex]) return;
        playVictoryChime();
        const next = { ...claimedChests, [stepIndex]: true };
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
            window.dispatchEvent(new Event("storage"));
        } catch {}
        setProfile((prev) => ({
            ...prev,
            xp: prev.xp + 25,
            gems: prev.gems + 10,
        }));
        setRefillMessage(`🎁 Milestone Claimed! +25 XP & +10 Gems!`);
        setTimeout(() => setRefillMessage(null), 3500);

        try {
            await claimMilestoneChest(stepIndex);
        } catch (e) {
            console.error("Failed to persist milestone chest reward:", e);
        }
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

    return (
        <div className="dashboard-container">
            {/* 1. TOP STICKY HUD */}
            <header className="dashboard-hud">
                <div className="hud-left">
                    <Link href="/" className="brand-logo">
                        <span style={{ fontSize: "1.6rem" }}>⚡</span>
                        <span>QuizWeb</span>
                    </Link>

                    {/* Unified Fullstack Roadmap Badge */}
                    <div className="hud-roadmap-badge" title="Fullstack Web Development Curriculum">
                        <span className="badge-icon">🗺️</span>
                        <span className="badge-label">Fullstack Web Roadmap</span>
                        <span className="badge-pill">17 Sections</span>
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
                <div className="notification-float-toast">
                    {refillMessage}
                </div>
            )}

            {/* 2. MAIN LAYOUT: SNAKE MAP & SIDEBAR */}
            <main className="dashboard-main-layout">
                {/* LEFT: THE DUOLINGO LEARNING PATH */}
                <div className="learning-path-column">
                    {roadmapSteps.length === 0 ? (
                        <div className="empty-path-card">
                            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🚀</div>
                            <h3>Preparing Learning Path...</h3>
                            <p style={{ color: "var(--settings-text-muted)" }}>
                                Loading fullstack curriculum questions...
                            </p>
                        </div>
                    ) : (
                        <div className="continuous-path-flow">
                            {roadmapSteps.map(([stepIndex, nodes]) => {
                                const firstNode = nodes[0];
                                const unitTitle = firstNode?.unitTitle || `Section ${stepIndex}`;
                                const unitDesc = firstNode?.unitDescription || "Master these concepts to advance.";
                                const catName = firstNode?.catName || "HTML";
                                const secNum = firstNode?.secNum || 1;

                                let themeClass = "html-theme";
                                let catIcon = "🌐";
                                if (catName === "CSS") {
                                    themeClass = "css-theme";
                                    catIcon = "🎨";
                                } else if (catName === "JavaScript") {
                                    themeClass = "js-theme";
                                    catIcon = "⚡";
                                }

                                // Calculate completed nodes in this section
                                const completedCount = nodes.filter((n) => !!profile.completedNodes[n.id]).length;
                                const isUnitCompleted = completedCount === nodes.length && nodes.length > 0;
                                const totalSectionQuestions = nodes.reduce((acc, n) => acc + n.totalQuestions, 0);

                                const chestInfo = pathLayout.chestLayout.get(stepIndex);
                                const isTierStart = stepIndex === 1 || stepIndex === 8 || stepIndex === 14;

                                return (
                                    <React.Fragment key={stepIndex}>
                                        {/* Tier Milestone Banner */}
                                        {isTierStart && (
                                            <div
                                                className={`tier-milestone-banner ${
                                                    stepIndex === 1
                                                        ? "tier-beginner"
                                                        : stepIndex === 8
                                                        ? "tier-intermediate"
                                                        : "tier-advanced"
                                                }`}
                                            >
                                                <div className="tier-milestone-content">
                                                    <span className="tier-milestone-tag">
                                                        {stepIndex === 1
                                                            ? "Tier 1 • Foundations"
                                                            : stepIndex === 8
                                                            ? "Tier 2 • Dynamic Logic & Scripting"
                                                            : "Tier 3 • Fullstack Architecture"}
                                                    </span>
                                                    <h2 className="tier-milestone-title">
                                                        {stepIndex === 1
                                                            ? "🌱 Beginner Level"
                                                            : stepIndex === 8
                                                            ? "⚡ Intermediate Level"
                                                            : "🚀 Advanced Level"}
                                                    </h2>
                                                    <p className="tier-milestone-desc">
                                                        {stepIndex === 1
                                                            ? "HTML document structure, text content, hyperlinks, media embeds, semantic markup, and CSS fundamentals."
                                                            : stepIndex === 8
                                                            ? "JavaScript variables, operators, conditionals, loops, functions, forms, and data structures."
                                                            : "Advanced CSS flexbox/grid layouts, keyframe animations, DOM events, JSON, and async APIs."}
                                                    </p>
                                                </div>
                                                <div className="tier-milestone-badge">
                                                    {stepIndex === 1
                                                        ? "Sections 1 – 7"
                                                        : stepIndex === 8
                                                        ? "Sections 8 – 13"
                                                        : "Sections 14 – 17"}
                                                </div>
                                            </div>
                                        )}

                                        <section className="unit-section-flow" aria-label={unitTitle}>
                                            {/* Duolingo Unit Chunky Banner */}
                                            <div className={`unit-banner ${themeClass}`}>
                                                <div className="unit-header-top">
                                                    <span className="unit-tag">
                                                        {catIcon} {catName} • Section {secNum} (Step {stepIndex} of 17)
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="unit-guidebook-btn"
                                                        onClick={() => handleOpenGuidebook(catName, secNum, unitTitle)}
                                                        title={`Open Guidebook for ${catName} Section ${secNum}`}
                                                    >
                                                        <span>📖</span>
                                                        <span>Guidebook</span>
                                                    </button>
                                                </div>
                                                <h2 className="unit-title">{unitTitle}</h2>
                                                <p className="unit-desc">{unitDesc}</p>

                                                {/* Units / Topics covered chips */}
                                                {firstNode?.units && firstNode.units.length > 0 && (
                                                    <div className="unit-topics-preview" aria-label="Curriculum units covered">
                                                        {firstNode.units.map((unitText, uIdx) => (
                                                            <span key={uIdx} className="unit-topic-chip">
                                                                {unitText.split("(")[0].trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="unit-progress-chip">
                                                    <span>
                                                        {completedCount} / {nodes.length} Checkpoints
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        {totalSectionQuestions} {totalSectionQuestions === 1 ? "Question" : "Questions"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Snake Path Stepping Stone Nodes */}
                                            <div className="unit-nodes-container">
                                                {nodes.map((node) => {
                                                    const layout = pathLayout.nodeLayout.get(node.id);
                                                    const isCompleted = !!profile.completedNodes[node.id];
                                                    const isActive = node.id === activeNodeId;
                                                    const isLocked = !isCompleted && !isActive;
                                                    const isSelected = selectedNode?.id === node.id;
                                                    const posClass = layout?.posClass || "pos-center";

                                                    return (
                                                        <React.Fragment key={node.id}>
                                                            <div
                                                                ref={isActive ? activeNodeRef : null}
                                                                className={`node-wrapper ${posClass}`}
                                                            >
                                                                {/* Floating "START" Speech Bubble for active node */}
                                                                {isActive && !isSelected && (
                                                                    <div className="active-bubble">
                                                                        <span>START</span>
                                                                    </div>
                                                                )}

                                                                {/* Duolingo Popover Card on Click */}
                                                                {isSelected && (
                                                                    <div
                                                                        className="duo-popover"
                                                                        role="dialog"
                                                                        aria-label={`${node.difficultyName} Checkpoint details`}
                                                                    >
                                                                        <div className="duo-popover-content">
                                                                            <div className="duo-popover-header">
                                                                                <span
                                                                                    className={`duo-popover-badge ${
                                                                                        isCompleted
                                                                                            ? "badge-completed"
                                                                                            : isActive
                                                                                            ? "badge-active"
                                                                                            : "badge-locked"
                                                                                    }`}
                                                                                >
                                                                                    {isCompleted
                                                                                        ? "⭐ COMPLETED"
                                                                                        : isActive
                                                                                        ? "⚡ READY TO PLAY"
                                                                                        : "🔒 LOCKED LEVEL"}
                                                                                </span>
                                                                                <h4 className="duo-popover-title">
                                                                                    {node.difficultyName} Challenge
                                                                                </h4>
                                                                                <p className="duo-popover-subtitle">
                                                                                    {unitTitle} • Step {node.stepIndex} ({node.catName} Sec {node.secNum})
                                                                                </p>
                                                                            </div>

                                                                            <div className="duo-popover-stats">
                                                                                <div className="duo-stat-item">
                                                                                    <span className="duo-stat-icon">📝</span>
                                                                                    <span>{node.totalQuestions} Questions</span>
                                                                                </div>
                                                                                <div className="duo-stat-item">
                                                                                    <span className="duo-stat-icon">⚡</span>
                                                                                    <span>
                                                                                        +
                                                                                        {Math.round(
                                                                                            15 *
                                                                                                (node.difficultyId === 3
                                                                                                    ? 2.0
                                                                                                    : node.difficultyId === 2
                                                                                                    ? 1.5
                                                                                                    : 1.0)
                                                                                        )}{" "}
                                                                                        XP
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                            {isLocked ? (
                                                                                <div className="duo-popover-locked-container">
                                                                                    <div className="duo-popover-locked-msg">
                                                                                        <span style={{ fontSize: "1.4rem" }}>🔒</span>
                                                                                        <div>
                                                                                            <strong style={{ display: "block", color: "var(--settings-text-main, #0f172a)" }}>
                                                                                                Locked Checkpoint
                                                                                            </strong>
                                                                                            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--settings-text-muted, #64748b)", lineHeight: "1.35" }}>
                                                                                                Lessons must be completed in order. Want to jump straight here?
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="duo-popover-jump-notice">
                                                                                        <span style={{ fontSize: "1.1rem" }}>⚡</span>
                                                                                        <span>
                                                                                            Pass the <strong>Placement Challenge</strong> (Hard questions from prior levels) to test out!
                                                                                        </span>
                                                                                    </div>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="duo-popover-action-btn btn-jump"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            playClickSound();
                                                                                            router.push(
                                                                                                `/quiz?cat=${node.catName}&mode=skip&targetSec=${node.secNum}&targetDiff=${node.difficultyName}&targetNodeId=${node.id}`
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        <span>⚡ JUMP HERE (TEST OUT)</span>
                                                                                        <span className="duo-btn-badge">Placement Test</span>
                                                                                    </button>
                                                                                </div>
                                                                            ) : (
                                                                                <button
                                                                                    type="button"
                                                                                    className={`duo-popover-action-btn ${
                                                                                        isCompleted ? "btn-practice" : "btn-start"
                                                                                    }`}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        playClickSound();
                                                                                        router.push(
                                                                                            `/quiz?cat=${node.catName}&sec=${node.secNum}&diff=${node.difficultyName}`
                                                                                        );
                                                                                    }}
                                                                                >
                                                                                    <span>{isCompleted ? "PRACTICE" : "START"}</span>
                                                                                    <span className="duo-btn-badge">
                                                                                        +{isCompleted ? 10 : 15} XP
                                                                                    </span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        <div className="duo-popover-arrow" />
                                                                    </div>
                                                                )}

                                                                {/* Active Ring Halo for Current Node */}
                                                                {isActive && <div className="active-ring-halo" />}

                                                                {/* 3D Duolingo Circular Stepping Stone */}
                                                                <button
                                                                    type="button"
                                                                    className={`node-btn ${
                                                                        isCompleted ? "completed" : isActive ? "active" : "locked"
                                                                    } ${isSelected ? "selected-node" : ""}`}
                                                                    onClick={() => handleNodeClick(node)}
                                                                    title={`${node.difficultyName}: ${node.totalQuestions} Questions (Click to open)`}
                                                                    aria-label={`${node.difficultyName} checkpoint in ${unitTitle}`}
                                                                >
                                                                    {/* Top Convex Gloss Shine */}
                                                                    <span className="node-btn-shine" />

                                                                    {isCompleted ? (
                                                                        <svg
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                            width="34"
                                                                            height="34"
                                                                            viewBox="0 0 24 24"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            strokeWidth="3.5"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        >
                                                                            <polyline points="20 6 9 17 4 12" />
                                                                        </svg>
                                                                    ) : isActive ? (
                                                                        <svg
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                            width="30"
                                                                            height="30"
                                                                            viewBox="0 0 24 24"
                                                                            fill="currentColor"
                                                                        >
                                                                            <polygon points="6 3 20 12 6 21 6 3" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                            width="24"
                                                                            height="24"
                                                                            viewBox="0 0 24 24"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2.5"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        >
                                                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                                                        </svg>
                                                                    )}
                                                                </button>

                                                                {/* Stars under completed node */}
                                                                {isCompleted && (
                                                                    <div className="node-stars">
                                                                        <span>★</span>
                                                                        <span>★</span>
                                                                        <span>★</span>
                                                                    </div>
                                                                )}

                                                                {/* Node Label */}
                                                                <div className="node-label">
                                                                    <span className="node-diff-title">{node.difficultyName}</span>
                                                                    <span className="node-question-count">
                                                                        {node.totalQuestions}{" "}
                                                                        {node.totalQuestions === 1 ? "Question" : "Questions"}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Connecting Path Dots between consecutive nodes */}
                                                            {layout?.nextPosClass && (
                                                                <div className="path-connector-track" aria-hidden="true">
                                                                    {[0.25, 0.5, 0.75].map((t, dotIdx) => {
                                                                        const curX = layout.offsetPx;
                                                                        const nxtX = layout.nextOffsetPx ?? curX;
                                                                        const dotX = Math.round(curX + (nxtX - curX) * t);
                                                                        return (
                                                                            <span
                                                                                key={dotIdx}
                                                                                className={`path-dot ${isCompleted ? "completed" : ""}`}
                                                                                style={{ transform: `translateX(${dotX}px)` }}
                                                                            />
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}

                                                {/* Milestone Chest at end of Section */}
                                                <div
                                                    className={`node-wrapper ${chestInfo?.posClass || "pos-center"}`}
                                                    style={{ marginTop: "16px" }}
                                                >
                                                    <button
                                                        type="button"
                                                        className={`chest-node ${isUnitCompleted ? "unlocked" : "locked"} ${
                                                            claimedChests[stepIndex] ? "claimed" : ""
                                                        }`}
                                                        onClick={() => handleClaimChest(stepIndex)}
                                                        disabled={!isUnitCompleted || claimedChests[stepIndex]}
                                                        title={
                                                            claimedChests[stepIndex]
                                                                ? "Chest Claimed!"
                                                                : isUnitCompleted
                                                                ? "Click to claim Milestone Chest (+25 XP, +10 Gems)!"
                                                                : "Complete all checkpoints to unlock bonus chest!"
                                                        }
                                                    >
                                                        <span className="chest-emoji">
                                                            {claimedChests[stepIndex] ? "✨" : isUnitCompleted ? "🎁" : "🔒"}
                                                        </span>
                                                    </button>
                                                    <div className="node-label">
                                                        <span
                                                            className="node-diff-title"
                                                            style={{
                                                                color: claimedChests[stepIndex]
                                                                    ? "#10b981"
                                                                    : isUnitCompleted
                                                                    ? "#d97706"
                                                                    : "var(--settings-text-muted)",
                                                            }}
                                                        >
                                                            {claimedChests[stepIndex]
                                                                ? "Bonus Claimed"
                                                                : isUnitCompleted
                                                                ? "Open Chest!"
                                                                : "Unit Milestone"}
                                                        </span>
                                                        <span className="node-question-count">
                                                            {claimedChests[stepIndex] ? "Claimed" : "+25 XP • +10 💎"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Connecting Path Dots from Chest to next Section */}
                                                {chestInfo?.nextPosClass && (
                                                    <div className="path-connector-track" aria-hidden="true">
                                                        {[0.25, 0.5, 0.75].map((t, dotIdx) => {
                                                            const curX = chestInfo.offsetPx;
                                                            const nxtX = chestInfo.nextOffsetPx ?? curX;
                                                            const dotX = Math.round(curX + (nxtX - curX) * t);
                                                            return (
                                                                <span
                                                                    key={dotIdx}
                                                                    className={`path-dot ${isUnitCompleted ? "completed" : ""}`}
                                                                    style={{ transform: `translateX(${dotX}px)` }}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* RIGHT: WIDGETS SIDEBAR */}
                <aside className="sidebar-column">
                    {/* Widget 1: Level & XP Stats */}
                    <div className="widget-card">
                        <div className="level-badge-row">
                            <div className="level-number-badge">{profile.level}</div>
                            <div className="level-meta">
                                <span className="level-name">{getLevelTitle(profile.level)}</span>
                                <span className="level-xp-sub">{profile.xp} Total XP earned</span>
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
                            <span
                                style={{
                                    fontSize: "0.8rem",
                                    color: "var(--settings-text-muted)",
                                    fontWeight: "600",
                                }}
                            >
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
                                        width: `${Math.min(100, Math.round(((profile.xp % 100) / 30) * 100))}%`,
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
                            <span
                                style={{
                                    fontSize: "0.8rem",
                                    color: "var(--settings-text-muted)",
                                    fontWeight: "700",
                                }}
                            >
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
                                            <span>
                                                {player.username} {isUser && "(You)"}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                fontWeight: "700",
                                                color: "var(--settings-primary, #7c3aed)",
                                            }}
                                        >
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

            {/* 3. DUOLINGO GUIDEBOOK MODAL */}
            {guidebookModal && (
                <div
                    className="guidebook-modal-backdrop"
                    onClick={() => setGuidebookModal(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Unit Guidebook"
                >
                    <div
                        className="guidebook-modal-card"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="guidebook-modal-header">
                            <div>
                                <span className="guidebook-tag">
                                    {guidebookModal.catName} • Section {guidebookModal.secNum}
                                </span>
                                <h3 className="guidebook-title">{guidebookModal.section.title}</h3>
                            </div>
                            <button
                                type="button"
                                className="guidebook-close-btn"
                                onClick={() => setGuidebookModal(null)}
                                aria-label="Close Guidebook"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="guidebook-body">
                            <p className="guidebook-summary">{guidebookModal.section.summary}</p>

                            <div className="guidebook-section-subtitle">Key Concepts & Rules</div>
                            <ul className="guidebook-points-list">
                                {guidebookModal.section.keyPoints.map((point, index) => (
                                    <li key={index} className="guidebook-point-item">
                                        <span className="point-icon">✓</span>
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="guidebook-section-subtitle">Code Example</div>
                            <pre className="guidebook-code-block">
                                <code>{guidebookModal.section.codeExample}</code>
                            </pre>
                        </div>

                        <div className="guidebook-modal-footer">
                            <button
                                type="button"
                                className="guidebook-gotit-btn"
                                onClick={() => setGuidebookModal(null)}
                            >
                                GOT IT!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
