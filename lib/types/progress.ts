export interface CanonicalCurriculumUnitItem {
  unit_id: number;
  unit_title: string;
  unit_order: number;
  sec_id: number;
  sec_num: number;
  cat_name: string;
}

export interface CatalogUnitSummary {
  unit_id: number;
  unit_title: string;
  unit_order: number;
  sec_id: number;
  sec_num: number;
  sec_title: string;
  difficulty_id: number;
  difficulty_name: string;
  cat_id: number;
  cat_name: string;
  total_slides: number;
  slide_count: number;
  quiz_count: number;
  has_coding_assessment: boolean;
}

export interface CurriculumUnlockStateResult {
  unlockedUnitIds: Set<number>;
  unlockedSectionIds: Set<number>;
  completedSectionIds: Set<number>;
  completedUnitIds: Set<number>;
  activeUnitId: number | null;
  activeSectionId: number | null;
}

export interface UserLessonProgress {
  progress_id: number;
  user_id: number;
  unit_id: number;
  current_slide_order: number;
  total_slides: number;
  is_completed: boolean;
  completed_at: string | null;
  last_accessed_at: string;
  unit_title: string;
  sec_id: number;
  sec_num: number;
  sec_title?: string;
  difficulty_name?: string;
  cat_id: number;
  cat_name: string;
  resume_type?: "in_progress" | "up_next" | "completed_all";
  next_unit_id?: number | null;
  next_unit_title?: string | null;
  next_sec_id?: number | null;
  next_sec_num?: number | null;
  next_cat_name?: string | null;
  next_slide_order?: number | null;
}

export interface UnitProgressItem {
  unit_id: number;
  unit_title: string;
  current_slide_order: number;
  total_slides: number;
  is_completed: boolean;
  is_locked: boolean;
  percentage: number;
  activity_count: number;
  completed_activity_count: number;
  activity_percentage: number;
  unit_order?: number;
}

export interface UserSectionProgress {
  section: {
    sec_id: number;
    sec_num: number;
    cat_id: number;
    cat_name: string;
    sec_title?: string;
    difficulty_name?: string;
    difficulty_id?: number;
    is_locked?: boolean;
  };
  units: UnitProgressItem[];
  overallPercentage: number;
  totalUnits: number;
  completedUnits: number;
  totalActivities: number;
  completedActivities: number;
}

export interface PreloadedSectionMeta {
  sec_id: number;
  sec_num: number;
  sec_title: string;
  cat_id: number;
  cat_name: string;
  difficulty_id: number;
  difficulty_name: string;
}

export interface PreloadedUnitPayload {
  unit_id: number;
  unit_title: string;
  unit_order: number;
  sec_id: number;
  sec_num: number;
  cat_id: number;
  cat_name: string;
  difficulty_id: number;
  difficulty_name: string;
  type_name: string;
  is_unlocked: boolean;
  is_completed: boolean;
  current_slide_order: number;
  total_slides: number;
  has_coding_assessment: boolean;
  quiz_count: number;
  lesson_card: {
    lesson_title: string;
    lesson_slide: Array<{
      lesson_title: string;
      lesson_text: string;
      lesson_code: string;
    }>;
  };
  quizzes: unknown[];
  assessment: Record<string, unknown> | null;
  nextUnit: {
    unit_id: number;
    unit_title: string;
    sec_id: number;
    sec_num: number;
    cat_name: string;
  } | null;
}

export interface LearnPreloadResponse {
  currentSection: PreloadedSectionMeta;
  nextSection: PreloadedSectionMeta | null;
  activeUnitId: number | null;
  activeSectionId: number;
  nextSectionId: number | null;
  units: Record<number, PreloadedUnitPayload>;
  unitIds: number[];
  cachedAt: number;
  userId?: number;
}
