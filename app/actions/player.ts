"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ensureLookupTables } from "@/lib/seedLookup";
import type { RowDataPacket } from "mysql2";

export interface LearnerProfile {
    userId: number;
    username: string;
    xp: number;
    level: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number;
    levelProgressPercent: number;
    currentStreak: number;
    maxStreak: number;
    lastQuizDate: string | null;
    hearts: number;
    gems: number;
    currentSection: number;
    completedNodes: Record<string, number>; // key: `${catId}-${secId}-${diffId}` => stars
}

export interface CurriculumNode {
    id: string; // `${catId}-${secId}-${diffId}`
    stepIndex: number; // 1 to 17 in the unified roadmap
    tier: "Beginner" | "Intermediate" | "Advanced";
    catId: number;
    catName: string;
    secId: number;
    secNum: number;
    difficultyId: number;
    difficultyName: string;
    totalQuestions: number;
    unitTitle: string;
    unitDescription: string;
    units: string[];
}

export interface LeaderboardEntry {
    rank: number;
    userId: number;
    username: string;
    xp: number;
    streak: number;
    league: "Gold" | "Silver" | "Bronze";
}

export type { RoadmapSectionDef } from "@/lib/curriculumRoadmap";
import { UNIFIED_CURRICULUM_ROADMAP } from "@/lib/curriculumRoadmap";

export async function getLearnerProfile(): Promise<LearnerProfile | null> {
    const session = await auth();
    if (!session?.user?.id) {
        return null;
    }

    const userId = Number(session.user.id);

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT user_id, username, xp, max_streak, current_streak, 
                    DATE_FORMAT(last_quiz_date, '%Y-%m-%d') as last_quiz_date, 
                    hearts, gems, current_section 
             FROM player_tbl WHERE user_id = ? LIMIT 1`,
            [userId]
        );

        if (rows.length === 0) {
            // Create initial player profile if missing
            await db.query(
                `INSERT INTO player_tbl (user_id, username, xp, max_streak, current_streak, hearts, gems, current_section)
                 VALUES (?, ?, 0, 0, 0, 5, 50, 1)
                 ON DUPLICATE KEY UPDATE user_id = user_id`,
                [userId, session.user.name || `User_${userId}`]
            );
            return {
                userId,
                username: session.user.name || `User_${userId}`,
                xp: 0,
                level: 1,
                xpForCurrentLevel: 0,
                xpForNextLevel: 100,
                levelProgressPercent: 0,
                currentStreak: 0,
                maxStreak: 0,
                lastQuizDate: null,
                hearts: 5,
                gems: 50,
                currentSection: 1,
                completedNodes: {},
            };
        }

        const p = rows[0];
        const xp = p.xp ?? 0;
        const level = Math.max(1, Math.floor(Math.sqrt(xp / 10)) + 1);
        const xpForCurrentLevel = (level - 1) * (level - 1) * 10;
        const xpForNextLevel = level * level * 10;
        const span = xpForNextLevel - xpForCurrentLevel;
        const levelProgressPercent = span > 0 
            ? Math.min(100, Math.max(0, Math.round(((xp - xpForCurrentLevel) / span) * 100))) 
            : 0;

        // Fetch completed nodes
        const [progressRows] = await db.query<RowDataPacket[]>(
            `SELECT cat_id, sec_id, difficulty_id, stars 
             FROM player_progress_tbl 
             WHERE user_id = ?`,
            [userId]
        );

        const completedNodes: Record<string, number> = {};
        for (const row of progressRows) {
            completedNodes[`${row.cat_id}-${row.sec_id}-${row.difficulty_id}`] = row.stars ?? 1;
        }

        return {
            userId,
            username: p.username || session.user.name || `User_${userId}`,
            xp,
            level,
            xpForCurrentLevel,
            xpForNextLevel,
            levelProgressPercent,
            currentStreak: p.current_streak ?? 0,
            maxStreak: p.max_streak ?? 0,
            lastQuizDate: p.last_quiz_date ?? null,
            hearts: Math.min(5, Math.max(0, p.hearts ?? 5)),
            gems: p.gems ?? 50,
            currentSection: p.current_section ?? 1,
            completedNodes,
        };
    } catch (err) {
        console.error("getLearnerProfile error:", err);
        return null;
    }
}

export async function recordQuizAnswer(quizId: number, isCorrect: boolean) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "You must be signed in to record quiz progress." };
    }

    const userId = Number(session.user.id);

    try {
        // 1. Get quiz info (category, section, difficulty, multiplier)
        const [quizRows] = await db.query<RowDataPacket[]>(
            `SELECT q.quiz_id, q.cat_id, q.sec_id, q.difficulty_id, d.xp_multiplier 
             FROM quiz_tbl q
             JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
             WHERE q.quiz_id = ? LIMIT 1`,
            [quizId]
        );

        if (quizRows.length === 0) {
            return { error: "Quiz not found." };
        }

        const quiz = quizRows[0];
        const multiplier = parseFloat(quiz.xp_multiplier) || 1.0;

        // 2. Fetch current player stats
        const [playerRows] = await db.query<RowDataPacket[]>(
            `SELECT user_id, xp, max_streak, current_streak, 
                    DATE_FORMAT(last_quiz_date, '%Y-%m-%d') as last_quiz_date, 
                    hearts, gems, current_section 
             FROM player_tbl WHERE user_id = ? LIMIT 1`,
            [userId]
        );

        const player = playerRows[0] || {
            xp: 0,
            max_streak: 0,
            current_streak: 0,
            last_quiz_date: null,
            hearts: 5,
            gems: 50,
            current_section: 1,
        };

        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        let currentStreak = player.current_streak ?? 0;
        let maxStreak = player.max_streak ?? 0;
        let xpGained = 0;
        let gemsGained = 0;
        let newHearts = player.hearts ?? 5;

        if (isCorrect) {
            // Calculate streak
            if (player.last_quiz_date === yesterday) {
                currentStreak += 1;
            } else if (player.last_quiz_date === today) {
                // Streak maintained today
            } else {
                currentStreak = 1;
            }

            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
            }

            // XP and Gems
            xpGained = Math.round(15 * multiplier);
            gemsGained = 3;

            // Record completed checkpoint node in player_progress_tbl
            await db.query(
                `INSERT INTO player_progress_tbl (user_id, cat_id, sec_id, difficulty_id, stars)
                 VALUES (?, ?, ?, ?, 3)
                 ON DUPLICATE KEY UPDATE stars = GREATEST(stars, 3)`,
                [userId, quiz.cat_id, quiz.sec_id, quiz.difficulty_id]
            );
        } else {
            // Deduct heart on wrong answer (min 0)
            newHearts = Math.max(0, (player.hearts ?? 5) - 1);
        }

        // Update player_tbl
        await db.query(
            `UPDATE player_tbl 
             SET xp = xp + ?, 
                 current_streak = ?, 
                 max_streak = ?, 
                 last_quiz_date = ?, 
                 hearts = ?, 
                 gems = gems + ? 
             WHERE user_id = ?`,
            [xpGained, currentStreak, maxStreak, today, newHearts, gemsGained, userId]
        );

        return {
            success: true,
            isCorrect,
            xpGained,
            gemsGained,
            currentStreak,
            maxStreak,
            heartsLeft: newHearts,
        };
    } catch (err) {
        console.error("recordQuizAnswer error:", err);
        return { error: "Failed to record quiz progress." };
    }
}

export async function getCurriculumMap(catName?: string): Promise<CurriculumNode[]> {
    try {
        await ensureLookupTables();

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT c.cat_id, c.cat_name, s.sec_id, s.sec_num, 
                    d.difficulty_id, d.difficulty_name,
                    COUNT(q.quiz_id) as total_questions
             FROM cat_tbl c
             JOIN sec_tbl s
             JOIN difficulty_tbl d
             JOIN quiz_tbl q ON q.cat_id = c.cat_id AND q.sec_id = s.sec_id AND q.difficulty_id = d.difficulty_id
             GROUP BY c.cat_id, c.cat_name, s.sec_id, s.sec_num, d.difficulty_id, d.difficulty_name
             ORDER BY c.cat_id ASC, s.sec_num ASC, d.difficulty_id ASC`
        );

        const rowMap = new Map<string, RowDataPacket[]>();
        for (const r of rows) {
            const key = `${r.cat_name}-${r.sec_num}`;
            const list = rowMap.get(key) || [];
            list.push(r);
            rowMap.set(key, list);
        }

        const roadmap = catName
            ? UNIFIED_CURRICULUM_ROADMAP.filter((r) => r.catName.toLowerCase() === catName.toLowerCase())
            : UNIFIED_CURRICULUM_ROADMAP;

        const nodes: CurriculumNode[] = [];

        for (const step of roadmap) {
            const key = `${step.catName}-${step.secNum}`;
            const matchingRows = rowMap.get(key) || [];
            matchingRows.sort((a, b) => a.difficulty_id - b.difficulty_id);

            if (matchingRows.length === 0) {
                const catId = step.catName === "HTML" ? 1 : step.catName === "CSS" ? 2 : 3;
                const secId = step.secNum;
                const diffs = [
                    { id: 1, name: "Easy" },
                    { id: 2, name: "Medium" },
                    { id: 3, name: "Hard" },
                ];
                for (const d of diffs) {
                    nodes.push({
                        id: `${catId}-${secId}-${d.id}`,
                        stepIndex: step.stepIndex,
                        tier: step.tier,
                        catId,
                        catName: step.catName,
                        secId,
                        secNum: step.secNum,
                        difficultyId: d.id,
                        difficultyName: d.name,
                        totalQuestions: 15,
                        unitTitle: step.title,
                        unitDescription: step.desc,
                        units: step.units,
                    });
                }
            } else {
                for (const r of matchingRows) {
                    nodes.push({
                        id: `${r.cat_id}-${r.sec_id}-${r.difficulty_id}`,
                        stepIndex: step.stepIndex,
                        tier: step.tier,
                        catId: r.cat_id,
                        catName: r.cat_name,
                        secId: r.sec_id,
                        secNum: r.sec_num,
                        difficultyId: r.difficulty_id,
                        difficultyName: r.difficulty_name,
                        totalQuestions: Number(r.total_questions) || 0,
                        unitTitle: step.title,
                        unitDescription: step.desc,
                        units: step.units,
                    });
                }
            }
        }

        return nodes;
    } catch (err) {
        console.error("getCurriculumMap error:", err);
        return [];
    }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT user_id, username, xp, current_streak
             FROM player_tbl
             ORDER BY xp DESC, current_streak DESC
             LIMIT 10`
        );

        return rows.map((r, index) => {
            const rank = index + 1;
            let league: "Gold" | "Silver" | "Bronze" = "Bronze";
            if (rank <= 3) league = "Gold";
            else if (rank <= 7) league = "Silver";

            return {
                rank,
                userId: r.user_id,
                username: r.username || `Player_${r.user_id}`,
                xp: r.xp || 0,
                streak: r.current_streak || 0,
                league,
            };
        });
    } catch (err) {
        console.error("getLeaderboard error:", err);
        return [];
    }
}

export async function refillHearts(): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated." };
    }

    const userId = Number(session.user.id);

    try {
        const [playerRows] = await db.query<RowDataPacket[]>(
            "SELECT gems, hearts FROM player_tbl WHERE user_id = ? LIMIT 1",
            [userId]
        );

        if (playerRows.length === 0) {
            return { success: false, error: "Player profile not found. Please refresh the page." };
        }

        const currentHearts = playerRows[0]?.hearts ?? 5;
        if (currentHearts >= 5) {
            return { success: false, error: "Hearts are already full!" };
        }

        const gems = playerRows[0]?.gems ?? 0;
        const cost = 20;

        if (gems < cost) {
            return { success: false, error: "Not enough gems to refill hearts (20 gems needed)." };
        }

        await db.query(
            "UPDATE player_tbl SET hearts = 5, gems = gems - ? WHERE user_id = ?",
            [cost, userId]
        );

        return { success: true };
    } catch (err) {
        console.error("refillHearts error:", err);
        return { success: false, error: "Failed to refill hearts." };
    }
}

export async function claimMilestoneChest(
    stepIndex: number
): Promise<{ success: boolean; error?: string; xpGained?: number; gemsGained?: number }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated." };
    }

    if (!stepIndex || stepIndex < 1 || stepIndex > 17) {
        return { success: false, error: "Invalid milestone section." };
    }

    const userId = Number(session.user.id);
    const bonusXp = 25;
    const bonusGems = 10;

    try {
        await db.query(
            `UPDATE player_tbl 
             SET xp = xp + ?, 
                 gems = gems + ? 
             WHERE user_id = ?`,
            [bonusXp, bonusGems, userId]
        );

        return {
            success: true,
            xpGained: bonusXp,
            gemsGained: bonusGems,
        };
    } catch (err) {
        console.error("claimMilestoneChest error:", err);
        return { success: false, error: "Failed to claim milestone bonus." };
    }
}

export async function completeSkipChallenge(
    catName: string,
    targetNodeId: string,
    targetSecNum: number
): Promise<{ success: boolean; error?: string; unlockedCount?: number; xpGained?: number }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated." };
    }

    const userId = Number(session.user.id);

    try {
        const curriculum = await getCurriculumMap();
        const targetIndex = curriculum.findIndex((n) => n.id === targetNodeId);

        if (targetIndex === -1) {
            return { success: false, error: "Target checkpoint not found." };
        }

        // Mark all lower nodes strictly before the target node as completed with 3 stars
        const nodesToComplete = curriculum.slice(0, targetIndex);

        for (const node of nodesToComplete) {
            await db.query(
                `INSERT INTO player_progress_tbl (user_id, cat_id, sec_id, difficulty_id, stars)
                 VALUES (?, ?, ?, ?, 3)
                 ON DUPLICATE KEY UPDATE stars = GREATEST(stars, 3)`,
                [userId, node.catId, node.secId, node.difficultyId]
            );
        }

        const bonusXp = 50;
        const bonusGems = 15;

        // Update player section and award jump bonus
        await db.query(
            `UPDATE player_tbl 
             SET current_section = GREATEST(current_section, ?),
                 xp = xp + ?,
                 gems = gems + ?
             WHERE user_id = ?`,
            [targetSecNum, bonusXp, bonusGems, userId]
        );

        return {
            success: true,
            unlockedCount: nodesToComplete.length,
            xpGained: bonusXp,
        };
    } catch (err) {
        console.error("completeSkipChallenge error:", err);
        return { success: false, error: "Failed to apply skip challenge progress." };
    }
}
