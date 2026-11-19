import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { createSafeCache } from "@/lib/server/cache";
import type { QuizFacetedCount, QuizMetricsData } from "@/lib/types/quiz";
import { getCachedQuizMetadata } from "./queries";

async function fetchQuizMetricsUncached(): Promise<QuizMetricsData> {
  try {
    const [metadata, [facetedRows], [secRows]] = await Promise.all([
      getCachedQuizMetadata(),
      db.query<RowDataPacket[]>(`
        SELECT c.cat_name, d.difficulty_name, t.type_name, COUNT(q.quiz_id) AS count
        FROM quiz_tbl q
        JOIN unit_tbl u ON q.unit_id = u.unit_id
        JOIN sec_tbl s ON u.sec_id = s.sec_id
        JOIN cat_tbl c ON s.cat_id = c.cat_id
        JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
        JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
        GROUP BY c.cat_name, d.difficulty_name, t.type_name
      `),
      db.query<RowDataPacket[]>(`
        SELECT s.sec_id, s.sec_num, COUNT(q.quiz_id) AS count
        FROM sec_tbl s
        LEFT JOIN unit_tbl u ON s.sec_id = u.sec_id
        LEFT JOIN quiz_tbl q ON u.unit_id = q.unit_id
        GROUP BY s.sec_id, s.sec_num
        ORDER BY s.sec_id
      `),
    ]);

    const facetedBreakdown: QuizFacetedCount[] = facetedRows.map((r) => ({
      cat_name: String(r.cat_name),
      difficulty_name: String(r.difficulty_name),
      type_name: String(r.type_name),
      count: Number(r.count),
    }));

    const catCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const diffCounts = new Map<string, number>();
    const matrixMap = new Map<string, Record<string, number>>();
    let totalQuizzes = 0;

    for (const row of facetedBreakdown) {
      totalQuizzes += row.count;
      catCounts.set(row.cat_name, (catCounts.get(row.cat_name) ?? 0) + row.count);
      typeCounts.set(row.type_name, (typeCounts.get(row.type_name) ?? 0) + row.count);
      diffCounts.set(
        row.difficulty_name,
        (diffCounts.get(row.difficulty_name) ?? 0) + row.count,
      );
      let catDiffs = matrixMap.get(row.cat_name);
      if (!catDiffs) {
        catDiffs = {};
        matrixMap.set(row.cat_name, catDiffs);
      }
      catDiffs[row.difficulty_name] =
        (catDiffs[row.difficulty_name] ?? 0) + row.count;
    }

    const toPct = (count: number) =>
      totalQuizzes > 0 ? Math.round((count / totalQuizzes) * 100) : 0;

    const byCategory = metadata.categories.map((c) => {
      const count = catCounts.get(c.cat_name) ?? 0;
      return {
        cat_id: Number(c.cat_id),
        cat_name: String(c.cat_name),
        count,
        percentage: toPct(count),
      };
    });

    const byType = metadata.types.map((t) => {
      const count = typeCounts.get(t.type_name) ?? 0;
      return {
        quiz_type_id: Number(t.quiz_type_id),
        type_name: String(t.type_name),
        count,
        percentage: toPct(count),
      };
    });

    const byDifficulty = metadata.difficulties.map((d) => {
      const count = diffCounts.get(d.difficulty_name) ?? 0;
      return {
        difficulty_id: Number(d.difficulty_id),
        difficulty_name: String(d.difficulty_name),
        count,
        percentage: toPct(count),
      };
    });

    const bySection = secRows.map((r) => ({
      sec_id: Number(r.sec_id),
      sec_num: String(r.sec_num),
      count: Number(r.count),
    }));
    const lowCoverageSections = bySection.filter((s) => s.count < 3);

    const matrix = metadata.categories.map((c) => {
      const diffs: Record<string, number> = {};
      let total = 0;
      const catRow = matrixMap.get(c.cat_name);
      for (const d of metadata.difficulties) {
        const cnt = catRow?.[d.difficulty_name] ?? 0;
        diffs[d.difficulty_name] = cnt;
        total += cnt;
      }
      return { cat_name: c.cat_name, difficulties: diffs, total };
    });

    return {
      totalQuizzes,
      byCategory,
      byType,
      byDifficulty,
      bySection,
      lowCoverageSections,
      matrix,
      facetedBreakdown,
    };
  } catch (error) {
    console.error("Failed to fetch quiz metrics:", error);
    return {
      totalQuizzes: 0,
      byCategory: [],
      byType: [],
      byDifficulty: [],
      bySection: [],
      lowCoverageSections: [],
      matrix: [],
      facetedBreakdown: [],
    };
  }
}

export const getCachedQuizMetrics = createSafeCache(
  fetchQuizMetricsUncached,
  ["quiz-metrics"],
  { tags: ["curriculum"], revalidate: 3600 },
);
