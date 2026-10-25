/**
 * Canonical Curriculum Progression Hierarchy & Level Definitions
 *
 * Defines the 3-tier curriculum architecture:
 *  - Beginner: HTML Sections 1–3 & CSS Sections 1–4
 *  - Intermediate: JavaScript Sections 1–5
 *  - Advanced: CSS Sections 5–6 & JavaScript Sections 6–7
 */

export type DifficultyLevelName = "Beginner" | "Intermediate" | "Advanced";

export interface CanonicalSection {
  sec_id: number;
  cat_id: number;
  cat_name: "HTML" | "CSS" | "JavaScript";
  sec_num: number;
  sec_title: string;
  difficulty_id: number;
  difficulty_name: DifficultyLevelName;
}

export interface CurriculumTier {
  difficulty_id: number;
  name: DifficultyLevelName;
  description: string;
  sectionIds: number[];
}

/**
 * The canonical 16-section linear progression sequence.
 */
export const CANONICAL_SECTIONS: readonly CanonicalSection[] = [
  // Tier 1: Beginner (difficulty_id = 1)
  {
    sec_id: 1,
    cat_id: 1,
    cat_name: "HTML",
    sec_num: 1,
    sec_title: "Getting Started",
    difficulty_id: 1,
    difficulty_name: "Beginner",
  },
  {
    sec_id: 2,
    cat_id: 1,
    cat_name: "HTML",
    sec_num: 2,
    sec_title: "Linking Your World",
    difficulty_id: 1,
    difficulty_name: "Beginner",
  },
  {
    sec_id: 3,
    cat_id: 1,
    cat_name: "HTML",
    sec_num: 3,
    sec_title: "Structuring Pages",
    difficulty_id: 1,
    difficulty_name: "Beginner",
  },
  {
    sec_id: 4,
    cat_id: 2,
    cat_name: "CSS",
    sec_num: 1,
    sec_title: "Styling Basics",
    difficulty_id: 1,
    difficulty_name: "Beginner",
  },
  {
    sec_id: 5,
    cat_id: 2,
    cat_name: "CSS",
    sec_num: 2,
    sec_title: "The Box Model",
    difficulty_id: 1,
    difficulty_name: "Beginner",
  },
  {
    sec_id: 6,
    cat_id: 2,
    cat_name: "CSS",
    sec_num: 3,
    sec_title: "Visual Styling",
    difficulty_id: 1,
    difficulty_name: "Beginner",
  },
  {
    sec_id: 7,
    cat_id: 2,
    cat_name: "CSS",
    sec_num: 4,
    sec_title: "Layout Foundations",
    difficulty_id: 1,
    difficulty_name: "Beginner",
  },

  // Tier 2: Intermediate (difficulty_id = 2)
  {
    sec_id: 8,
    cat_id: 3,
    cat_name: "JavaScript",
    sec_num: 1,
    sec_title: "Programming Basics",
    difficulty_id: 2,
    difficulty_name: "Intermediate",
  },
  {
    sec_id: 9,
    cat_id: 3,
    cat_name: "JavaScript",
    sec_num: 2,
    sec_title: "Control Flow",
    difficulty_id: 2,
    difficulty_name: "Intermediate",
  },
  {
    sec_id: 10,
    cat_id: 3,
    cat_name: "JavaScript",
    sec_num: 3,
    sec_title: "Functions",
    difficulty_id: 2,
    difficulty_name: "Intermediate",
  },
  {
    sec_id: 11,
    cat_id: 3,
    cat_name: "JavaScript",
    sec_num: 4,
    sec_title: "Modern JS Syntax",
    difficulty_id: 2,
    difficulty_name: "Intermediate",
  },
  {
    sec_id: 12,
    cat_id: 3,
    cat_name: "JavaScript",
    sec_num: 5,
    sec_title: "Collections",
    difficulty_id: 2,
    difficulty_name: "Intermediate",
  },

  // Tier 3: Advanced (difficulty_id = 3)
  {
    sec_id: 13,
    cat_id: 2,
    cat_name: "CSS",
    sec_num: 5,
    sec_title: "Advanced Layout",
    difficulty_id: 3,
    difficulty_name: "Advanced",
  },
  {
    sec_id: 14,
    cat_id: 2,
    cat_name: "CSS",
    sec_num: 6,
    sec_title: "Motion & Polish",
    difficulty_id: 3,
    difficulty_name: "Advanced",
  },
  {
    sec_id: 15,
    cat_id: 3,
    cat_name: "JavaScript",
    sec_num: 6,
    sec_title: "The DOM",
    difficulty_id: 3,
    difficulty_name: "Advanced",
  },
  {
    sec_id: 16,
    cat_id: 3,
    cat_name: "JavaScript",
    sec_num: 7,
    sec_title: "Working with Data",
    difficulty_id: 3,
    difficulty_name: "Advanced",
  },
] as const;

/**
 * Returns the next sequential section ID in the curriculum progression path,
 * or null if currentSectionId is the final section or invalid.
 */
export function getNextSectionId(currentSectionId: number | string): number | null {
  const secId = Number(currentSectionId);
  if (!Number.isFinite(secId)) return null;
  const index = CANONICAL_SECTIONS.findIndex((s) => s.sec_id === secId);
  if (index === -1 || index >= CANONICAL_SECTIONS.length - 1) {
    return null;
  }
  return CANONICAL_SECTIONS[index + 1].sec_id;
}

/**
 * Returns the next available section ID in the curriculum progression path that has content,
 * skipping empty sections with 0 approved units.
 * If availableSectionIds is not specified or empty, falls back to getNextSectionId.
 */
export function getNextAvailableSectionId(
  currentSectionId: number | string,
  availableSectionIds?: Set<number> | number[],
): number | null {
  const secId = Number(currentSectionId);
  if (!Number.isFinite(secId)) return null;
  const index = CANONICAL_SECTIONS.findIndex((s) => s.sec_id === secId);
  if (index === -1) return null;

  if (!availableSectionIds) {
    return getNextSectionId(currentSectionId);
  }

  const validIds =
    availableSectionIds instanceof Set
      ? availableSectionIds
      : new Set(availableSectionIds.map(Number));

  if (validIds.size === 0) {
    return getNextSectionId(currentSectionId);
  }

  for (let i = index + 1; i < CANONICAL_SECTIONS.length; i++) {
    const candidateId = CANONICAL_SECTIONS[i].sec_id;
    if (validIds.has(candidateId)) {
      return candidateId;
    }
  }

  return null;
}

/**
 * Returns the canonical sort order weight for a given section ID and unit order,
 * ensuring units sort strictly across tiers: Beginner -> Intermediate -> Advanced.
 */
export function getCanonicalSortOrder(
  secId: number | string,
  unitOrder: number | string = 1,
): number {
  const id = Number(secId);
  const order = Number(unitOrder) || 1;
  const index = CANONICAL_SECTIONS.findIndex((s) => s.sec_id === id);
  const sectionWeight = index !== -1 ? (index + 1) * 1000 : 99000;
  return sectionWeight + order;
}

/**
 * Returns the previous section ID in the curriculum progression path,
 * or null if currentSectionId is the first section or invalid.
 */
export function getPreviousSectionId(currentSectionId: number | string): number | null {
  const secId = Number(currentSectionId);
  if (!Number.isFinite(secId)) return null;
  const index = CANONICAL_SECTIONS.findIndex((s) => s.sec_id === secId);
  if (index <= 0) {
    return null;
  }
  return CANONICAL_SECTIONS[index - 1].sec_id;
}

/**
 * Returns the canonical metadata for a section ID.
 */
export function getSectionById(sectionId: number | string): CanonicalSection | undefined {
  const secId = Number(sectionId);
  if (!Number.isFinite(secId)) return undefined;
  return CANONICAL_SECTIONS.find((s) => s.sec_id === secId);
}

/**
 * Returns high-level curriculum metadata structured by progression tiers.
 */
export function getCurriculumMetadata() {
  const tiers: CurriculumTier[] = [
    {
      difficulty_id: 1,
      name: "Beginner",
      description: "HTML Sections 1–3 & CSS Sections 1–4",
      sectionIds: [1, 2, 3, 4, 5, 6, 7],
    },
    {
      difficulty_id: 2,
      name: "Intermediate",
      description: "JavaScript Sections 1–5",
      sectionIds: [8, 9, 10, 11, 12],
    },
    {
      difficulty_id: 3,
      name: "Advanced",
      description: "CSS Sections 5–6 & JavaScript Sections 6–7",
      sectionIds: [13, 14, 15, 16],
    },
  ];

  return {
    tiers,
    sections: CANONICAL_SECTIONS,
  };
}
