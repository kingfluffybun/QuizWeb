"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CANONICAL_SECTIONS, type CanonicalSection } from "@/lib/curriculum";
import { getUserCurriculumUnlockState } from "@/app/actions/progress";
import { getSectionDescription } from "@/lib/curriculum-descriptions";
import { isStaff } from "@/lib/rbac";
import type { RowDataPacket } from "mysql2/promise";

export interface RoadmapUnitNode {
  unit_id: number;
  unit_title: string;
  unit_order: number;
  sec_id: number;
  slide_count: number;
  quiz_count: number;
  has_coding_assessment: boolean;
  is_locked: boolean;
  is_completed: boolean;
  current_slide_order: number;
}

export interface RoadmapSection {
  sec_id: number;
  cat_id: number;
  cat_name: "HTML" | "CSS" | "JavaScript";
  sec_num: number;
  sec_title: string;
  difficulty_id: number;
  difficulty_name: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  is_locked: boolean;
  is_completed: boolean;
  total_units: number;
  total_slides: number;
  total_questions: number;
  units: RoadmapUnitNode[];
}

export interface CurriculumRoadmapData {
  sections: RoadmapSection[];
  userProgression: {
    userId?: number;
    activeSectionId: number | null;
    activeUnitId: number | null;
    unlockedSectionIds: number[];
    unlockedUnitIds: number[];
    completedSectionIds: number[];
    completedUnitIds: number[];
    isStaff: boolean;
  };
}

/**
 * Resolves user role from test session, auth session, or database lookup.
 */
async function resolveUserRole(explicitUserId?: number): Promise<string | null> {
  const testSession = (
    globalThis as unknown as {
      __TEST_AUTH_SESSION__?: {
        user?: { id?: string | number; role?: string; user_role?: string };
      } | null;
    }
  ).__TEST_AUTH_SESSION__;

  if (testSession?.user) {
    const sessionUserId = testSession.user.id ? Number(testSession.user.id) : undefined;
    const sessionRole = testSession.user.role || testSession.user.user_role;
    if (sessionRole && (!explicitUserId || explicitUserId === sessionUserId)) {
      return String(sessionRole);
    }
  }

  let sessionUserRole: string | undefined;
  let sessionUserId: number | undefined;
  try {
    const session = await auth();
    if (session?.user) {
      sessionUserId = session.user.id ? Number(session.user.id) : undefined;
      sessionUserRole = (session.user.role as string) || (session.user.user_role as string);
    }
  } catch {
    // Outside Next.js request context
  }

  const targetUserId = explicitUserId ?? sessionUserId;
  if (sessionUserRole && (!explicitUserId || explicitUserId === sessionUserId)) {
    return sessionUserRole;
  }

  if (targetUserId && Number.isInteger(targetUserId) && targetUserId > 0) {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
        [targetUserId],
      );
      if (rows.length > 0 && rows[0]?.user_role) {
        return String(rows[0].user_role);
      }
    } catch {
      // Graceful fallback
    }
  }

  return null;
}

/**
 * Server action to query the complete curriculum roadmap data:
 * - 16 canonical sections with rich educational descriptions
 * - Approved units grouped by section with lesson slide counts, quiz counts, and coding assessments
 * - Strict per-user unlock and completion status
 * - Aggregated section statistics (total units, slides, questions)
 */
export async function getCurriculumRoadmapData(
  explicitUserId?: number,
): Promise<CurriculumRoadmapData> {
  try {
    let userId = explicitUserId;
    if (!userId) {
      try {
        const session = await auth();
        if (session?.user?.id) userId = Number(session.user.id);
      } catch {
        // Outside Next.js request context
      }
    }

    const [userRole, unlockState] = await Promise.all([
      resolveUserRole(userId),
      getUserCurriculumUnlockState(userId),
    ]);

    const isStaffUser = isStaff(userRole);

    const [unitRows] = await db.query<RowDataPacket[]>(
      `SELECT 
         u.unit_id,
         u.unit_title,
         u.unit_order,
         u.sec_id,
         COALESCE(sc.slide_count, 0) AS slide_count,
         COALESCE(qc.quiz_count, 0) AS quiz_count,
         EXISTS(SELECT 1 FROM unit_assessment_tbl ua WHERE ua.unit_id = u.unit_id) AS has_coding_assessment,
         COALESCE(p.current_slide_order, 0) AS current_slide_order,
         COALESCE(p.is_completed, 0) AS user_completed
       FROM unit_tbl u
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       LEFT JOIN (
         SELECT unit_id, COUNT(*) AS slide_count FROM lesson_slide_tbl GROUP BY unit_id
       ) sc ON u.unit_id = sc.unit_id
       LEFT JOIN (
         SELECT unit_id, COUNT(*) AS quiz_count FROM quiz_tbl GROUP BY unit_id
       ) qc ON u.unit_id = qc.unit_id
       LEFT JOIN user_lesson_progress_tbl p ON u.unit_id = p.unit_id AND p.user_id = ?
       WHERE u.status = 'approved'
       ORDER BY FIELD(s.sec_id, 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16), u.unit_order ASC, u.unit_id ASC`,
      [userId || 0],
    );

    // Group units by section ID
    const unitsBySection = new Map<number, RoadmapUnitNode[]>();
    for (const row of unitRows) {
      const secId = Number(row.sec_id);
      const unitId = Number(row.unit_id);
      const isCompleted =
        Boolean(row.user_completed) || unlockState.completedUnitIds.has(unitId);
      const isLocked = isStaffUser ? false : !unlockState.unlockedUnitIds.has(unitId);

      const node: RoadmapUnitNode = {
        unit_id: unitId,
        unit_title: String(row.unit_title),
        unit_order: Number(row.unit_order ?? 1),
        sec_id: secId,
        slide_count: Number(row.slide_count ?? 0),
        quiz_count: Number(row.quiz_count ?? 0),
        has_coding_assessment: Boolean(row.has_coding_assessment),
        is_locked: isLocked,
        is_completed: isCompleted,
        current_slide_order: Number(row.current_slide_order ?? 0),
      };

      const list = unitsBySection.get(secId) ?? [];
      list.push(node);
      unitsBySection.set(secId, list);
    }

    // Build the 16 canonical sections
    const sections: RoadmapSection[] = CANONICAL_SECTIONS.map((sec: CanonicalSection) => {
      const secUnits = unitsBySection.get(sec.sec_id) ?? [];
      const totalUnits = secUnits.length;
      const totalSlides = secUnits.reduce((acc, u) => acc + u.slide_count, 0);
      const totalQuestions = secUnits.reduce((acc, u) => acc + u.quiz_count, 0);
      const isLocked = isStaffUser
        ? false
        : !unlockState.unlockedSectionIds.has(sec.sec_id);
      const isCompleted = unlockState.completedSectionIds.has(sec.sec_id);

      return {
        sec_id: sec.sec_id,
        cat_id: sec.cat_id,
        cat_name: sec.cat_name,
        sec_num: sec.sec_num,
        sec_title: sec.sec_title,
        difficulty_id: sec.difficulty_id,
        difficulty_name: sec.difficulty_name,
        description: getSectionDescription(sec.sec_id),
        is_locked: isLocked,
        is_completed: isCompleted,
        total_units: totalUnits,
        total_slides: totalSlides,
        total_questions: totalQuestions,
        units: secUnits,
      };
    });

    return {
      sections,
      userProgression: {
        userId,
        activeSectionId: unlockState.activeSectionId ?? 1,
        activeUnitId: unlockState.activeUnitId ?? (unitRows[0]?.unit_id ? Number(unitRows[0].unit_id) : null),
        unlockedSectionIds: Array.from(unlockState.unlockedSectionIds),
        unlockedUnitIds: Array.from(unlockState.unlockedUnitIds),
        completedSectionIds: Array.from(unlockState.completedSectionIds),
        completedUnitIds: Array.from(unlockState.completedUnitIds),
        isStaff: isStaffUser,
      },
    };
  } catch (error) {
    console.error("Failed to get curriculum roadmap data:", error);

    // Resilient fallback returning canonical sections with zero counters
    const fallbackSections: RoadmapSection[] = CANONICAL_SECTIONS.map((sec) => ({
      sec_id: sec.sec_id,
      cat_id: sec.cat_id,
      cat_name: sec.cat_name,
      sec_num: sec.sec_num,
      sec_title: sec.sec_title,
      difficulty_id: sec.difficulty_id,
      difficulty_name: sec.difficulty_name,
      description: getSectionDescription(sec.sec_id),
      is_locked: sec.sec_id !== 1,
      is_completed: false,
      total_units: 0,
      total_slides: 0,
      total_questions: 0,
      units: [],
    }));

    return {
      sections: fallbackSections,
      userProgression: {
        userId: explicitUserId,
        activeSectionId: 1,
        activeUnitId: null,
        unlockedSectionIds: [1],
        unlockedUnitIds: [],
        completedSectionIds: [],
        completedUnitIds: [],
        isStaff: false,
      },
    };
  }
}
