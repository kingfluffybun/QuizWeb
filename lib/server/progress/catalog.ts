import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { getSectionById } from "@/lib/curriculum";
import { createSafeCache } from "@/lib/server/cache";
import type {
  CanonicalCurriculumUnitItem,
  CatalogUnitSummary,
  PreloadedSectionMeta,
} from "@/lib/types/progress";

async function fetchCanonicalCurriculumUnitSequenceInternal(): Promise<
  CanonicalCurriculumUnitItem[]
> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT
       u.unit_id,
       u.unit_title,
       u.unit_order,
       s.sec_id,
       s.sec_num,
       c.cat_name
     FROM unit_tbl u
     JOIN sec_tbl s ON u.sec_id = s.sec_id
     JOIN cat_tbl c ON s.cat_id = c.cat_id
     WHERE u.status = 'approved'
     ORDER BY FIELD(s.sec_id, 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16), u.unit_order ASC, u.unit_id ASC`,
  );

  return rows.map((r) => ({
    unit_id: Number(r.unit_id),
    unit_title: String(r.unit_title),
    unit_order: Number(r.unit_order || 1),
    sec_id: Number(r.sec_id),
    sec_num: Number(r.sec_num),
    cat_name: String(r.cat_name),
  }));
}

export const getCanonicalCurriculumUnitSequence = createSafeCache(
  fetchCanonicalCurriculumUnitSequenceInternal,
  ["canonical-curriculum-unit-sequence"],
  { tags: ["curriculum"], revalidate: 3600 },
);

async function fetchApprovedUnitCatalogInternal(): Promise<CatalogUnitSummary[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT
       u.unit_id,
       u.unit_title,
       u.unit_order,
       s.sec_id,
       s.sec_num,
       s.sec_title,
       s.difficulty_id,
       COALESCE(d.difficulty_name, 'Beginner') AS difficulty_name,
       c.cat_id,
       c.cat_name,
       COALESCE(sc.slide_count, 0) AS slide_count,
       COALESCE(qc.quiz_count, 0) AS quiz_count,
       EXISTS(SELECT 1 FROM unit_assessment_tbl ua WHERE ua.unit_id = u.unit_id) AS has_coding_assessment
     FROM unit_tbl u
     JOIN sec_tbl s ON u.sec_id = s.sec_id
     JOIN cat_tbl c ON s.cat_id = c.cat_id
     LEFT JOIN difficulty_tbl d ON s.difficulty_id = d.difficulty_id
     LEFT JOIN (
       SELECT unit_id, COUNT(*) AS slide_count FROM lesson_slide_tbl GROUP BY unit_id
     ) sc ON u.unit_id = sc.unit_id
     LEFT JOIN (
       SELECT unit_id, COUNT(*) AS quiz_count FROM quiz_tbl GROUP BY unit_id
     ) qc ON u.unit_id = qc.unit_id
     WHERE u.status = 'approved'
     ORDER BY FIELD(s.sec_id, 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16), u.unit_order ASC, u.unit_id ASC`,
  );

  return rows.map((r) => {
    const slideCount = Number(r.slide_count ?? 0);
    return {
      unit_id: Number(r.unit_id),
      unit_title: String(r.unit_title),
      unit_order: Number(r.unit_order ?? 1),
      sec_id: Number(r.sec_id),
      sec_num: Number(r.sec_num),
      sec_title: String(r.sec_title ?? ""),
      difficulty_id: Number(r.difficulty_id ?? 1),
      difficulty_name: String(r.difficulty_name ?? "Beginner"),
      cat_id: Number(r.cat_id),
      cat_name: String(r.cat_name),
      slide_count: slideCount,
      total_slides: Math.max(1, slideCount),
      quiz_count: Number(r.quiz_count ?? 0),
      has_coding_assessment: Boolean(r.has_coding_assessment),
    };
  });
}

export const getCachedApprovedUnitCatalog = createSafeCache(
  fetchApprovedUnitCatalogInternal,
  ["approved-curriculum-unit-catalog"],
  { tags: ["curriculum"], revalidate: 3600 },
);

export function getCanonicalSectionMeta(secId: number): PreloadedSectionMeta {
  const found = getSectionById(secId);
  if (found) {
    return {
      sec_id: found.sec_id,
      sec_num: found.sec_num,
      sec_title: found.sec_title,
      cat_id: found.cat_id,
      cat_name: found.cat_name,
      difficulty_id: found.difficulty_id,
      difficulty_name: found.difficulty_name,
    };
  }
  return {
    sec_id: 1,
    sec_num: 1,
    sec_title: "Getting Started",
    cat_id: 1,
    cat_name: "HTML",
    difficulty_id: 1,
    difficulty_name: "Beginner",
  };
}
