"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CANONICAL_SECTIONS } from "@/lib/curriculum";
import { getUserCurriculumUnlockState } from "@/app/actions/progress";
import { recordUserActivity } from "@/app/actions/streak";
import { getClientLocalDate } from "@/lib/timezone";
import {
  toPublicCodeProblem,
  type PublicCodeProblem,
} from "@/lib/cp-schema";
import { resolveAuthoritativeAssessment } from "@/app/actions/cp-engine";
import { revalidatePath } from "next/cache";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export interface SkipProblemItem {
  unitId: number;
  unitTitle: string;
  unitOrder: number;
  secId: number;
  secTitle: string;
  secNum: number;
  catName: string;
  problem: PublicCodeProblem;
}

export interface SequentialSkipQueuePayload {
  targetSectionId: number;
  targetSectionTitle: string;
  targetSectionNum: number;
  targetCatName: string;
  skippedSections: Array<{
    sec_id: number;
    sec_num: number;
    sec_title: string;
    cat_name: string;
  }>;
  unitsQueue: SkipProblemItem[];
  totalCodingProblems: number;
  timePerProblemSeconds: number; // 300 (5 minutes)
  totalHearts: number; // 5
}

/**
 * Resolves the ordered queue of coding problems required to skip ahead to `targetSectionId`.
 * Gathers all uncompleted approved units across sections preceding `targetSectionId` that have
 * coding assessments. All answers are stripped via `toPublicCodeProblem`.
 */
export async function getSequentialSkipQueue(
  targetSectionId: number,
  explicitUserId?: number,
): Promise<SequentialSkipQueuePayload | null> {
  try {
    const targetId = Number(targetSectionId);
    if (!Number.isFinite(targetId) || targetId <= 1) {
      return null;
    }

    let userId = explicitUserId;
    if (!userId) {
      try {
        const session = await auth();
        if (session?.user?.id) userId = Number(session.user.id);
      } catch {
        // Continue for guest mode if invoked outside session
      }
    }

    const targetSection = CANONICAL_SECTIONS.find((s) => s.sec_id === targetId);
    if (!targetSection) {
      return null;
    }

    // Determine target index in canonical sequence
    const targetIndex = CANONICAL_SECTIONS.findIndex((s) => s.sec_id === targetId);
    const precedingSections = CANONICAL_SECTIONS.slice(0, targetIndex);
    const precedingSectionIds = precedingSections.map((s) => s.sec_id);

    if (precedingSectionIds.length === 0) {
      return null;
    }

    // Query user's completed units
    const unlockState = await getUserCurriculumUnlockState(userId);
    const completedUnitIds = unlockState.completedUnitIds;

    // Fetch approved units for preceding sections in canonical order
    const [unitRows] = await db.query<RowDataPacket[]>(
      `SELECT 
         u.unit_id,
         u.unit_title,
         u.unit_order,
         u.sec_id,
         s.sec_num,
         s.sec_title,
         c.cat_name,
         COUNT(ua.assessment_id) AS assessment_count
       FROM unit_tbl u
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       LEFT JOIN unit_assessment_tbl ua ON u.unit_id = ua.unit_id
       WHERE u.status = 'approved' AND u.sec_id IN (?)
       GROUP BY u.unit_id, u.unit_title, u.unit_order, u.sec_id, s.sec_num, s.sec_title, c.cat_name
       ORDER BY FIELD(u.sec_id, ?), u.unit_order ASC, u.unit_id ASC`,
      [precedingSectionIds, precedingSectionIds],
    );

    const unitsQueue: SkipProblemItem[] = [];

    for (const row of unitRows) {
      const uId = Number(row.unit_id);
      // If user has already completed this unit, skip it
      if (completedUnitIds.has(uId)) {
        continue;
      }

      // Check if unit has a coding assessment
      if (Number(row.assessment_count) <= 0) {
        continue;
      }

      const authoritative = await resolveAuthoritativeAssessment(uId);
      if (!authoritative || authoritative.assessment.steps.length === 0) {
        continue;
      }

      const publicProblem = toPublicCodeProblem(
        authoritative.resolvedUnitId,
        authoritative.unitTitle,
        authoritative.assessment,
      );

      unitsQueue.push({
        unitId: uId,
        unitTitle: String(row.unit_title),
        unitOrder: Number(row.unit_order),
        secId: Number(row.sec_id),
        secTitle: String(row.sec_title),
        secNum: Number(row.sec_num),
        catName: String(row.cat_name),
        problem: publicProblem,
      });
    }

    return {
      targetSectionId: targetSection.sec_id,
      targetSectionTitle: targetSection.sec_title,
      targetSectionNum: targetSection.sec_num,
      targetCatName: targetSection.cat_name,
      skippedSections: precedingSections.map((s) => ({
        sec_id: s.sec_id,
        sec_num: s.sec_num,
        sec_title: s.sec_title,
        cat_name: s.cat_name,
      })),
      unitsQueue,
      totalCodingProblems: unitsQueue.length,
      timePerProblemSeconds: 300, // 5 minutes per coding problem
      totalHearts: 5, // 5 hearts total for the entire skip session
    };
  } catch (error) {
    console.error("Failed to get sequential skip queue:", error);
    return null;
  }
}

/**
 * Server Action called upon successful completion of all coding problems in the skip session.
 * Marks all preceding units complete in `user_lesson_progress_tbl` and unlocks the target section.
 */
export async function completeSequentialSkip(input: {
  targetSectionId: number;
  explicitUserId?: number;
}): Promise<{
  success: boolean;
  unlockedSectionId: number;
  skippedUnitsCount: number;
  awardedXp: number;
  error?: string;
}> {
  try {
    const targetSectionId = Number(input?.targetSectionId);
    if (!Number.isFinite(targetSectionId) || targetSectionId <= 1) {
      return {
        success: false,
        unlockedSectionId: 1,
        skippedUnitsCount: 0,
        awardedXp: 0,
        error: "Invalid target section ID.",
      };
    }

    let userId = input?.explicitUserId;
    if (!userId) {
      try {
        const session = await auth();
        if (session?.user?.id) userId = Number(session.user.id);
      } catch {
        // Handled below if userId is missing
      }
    }

    if (!userId || !Number.isInteger(userId) || userId <= 0) {
      return {
        success: false,
        unlockedSectionId: targetSectionId,
        skippedUnitsCount: 0,
        awardedXp: 0,
        error: "Authentication required to persist section skip.",
      };
    }

    const targetIndex = CANONICAL_SECTIONS.findIndex(
      (s) => s.sec_id === targetSectionId,
    );
    if (targetIndex === -1) {
      return {
        success: false,
        unlockedSectionId: targetSectionId,
        skippedUnitsCount: 0,
        awardedXp: 0,
        error: "Target section not found in curriculum.",
      };
    }

    const precedingSections = CANONICAL_SECTIONS.slice(0, targetIndex);
    const precedingSectionIds = precedingSections.map((s) => s.sec_id);

    // Fetch all approved units in preceding sections
    const [unitRows] = await db.query<RowDataPacket[]>(
      `SELECT 
         u.unit_id,
         COALESCE(sc.slide_count, 1) AS total_slides
       FROM unit_tbl u
       LEFT JOIN (
         SELECT unit_id, COUNT(*) AS slide_count FROM lesson_slide_tbl GROUP BY unit_id
       ) sc ON u.unit_id = sc.unit_id
       WHERE u.status = 'approved' AND u.sec_id IN (?)`,
      [precedingSectionIds],
    );

    if (unitRows.length > 0) {
      // Mark all intervening units completed in user_lesson_progress_tbl
      for (const unit of unitRows) {
        const uId = Number(unit.unit_id);
        const totalSlides = Math.max(1, Number(unit.total_slides));

        await db.query<ResultSetHeader>(
          `INSERT INTO user_lesson_progress_tbl
             (user_id, unit_id, current_slide_order, total_slides, is_completed, completed_at, last_accessed_at)
           VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE
             current_slide_order = VALUES(total_slides),
             total_slides = GREATEST(total_slides, VALUES(total_slides)),
             is_completed = 1,
             completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
             last_accessed_at = CURRENT_TIMESTAMP`,
          [userId, uId, totalSlides, totalSlides],
        );
      }

      // Update player_tbl.current_section if needed
      await db.query(
        `UPDATE player_tbl 
         SET current_section = GREATEST(COALESCE(current_section, 1), ?) 
         WHERE user_id = ?`,
        [targetSectionId, userId],
      );
    }

    // Award XP (50 XP per skipped unit + 50 XP Skip Mastery bonus)
    const awardedXp = unitRows.length * 50 + 50;
    try {
      await recordUserActivity({
        type: "quiz",
        xp: awardedXp,
        date: getClientLocalDate(),
      });
    } catch (err) {
      console.error("Failed to record skip activity XP:", err);
    }

    // Revalidate paths for instant client-side update
    try {
      revalidatePath("/learn-ui");
      revalidatePath("/home");
      revalidatePath("/quiz");
    } catch {
      // Ignore outside request context
    }

    return {
      success: true,
      unlockedSectionId: targetSectionId,
      skippedUnitsCount: unitRows.length,
      awardedXp,
    };
  } catch (error) {
    console.error("Failed to complete sequential skip:", error);
    return {
      success: false,
      unlockedSectionId: 1,
      skippedUnitsCount: 0,
      awardedXp: 0,
      error: "An unexpected error occurred while recording section skip.",
    };
  }
}
