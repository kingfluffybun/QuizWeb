import type { RowDataPacket } from "mysql2";

export interface Category {
  cat_id: number;
  cat_name: string;
}

export interface Section {
  sec_id: number;
  sec_num: string;
  cat_id?: number;
  sec_title?: string;
  difficulty_id?: number;
}

export interface Difficulty {
  difficulty_id: number;
  difficulty_name: string;
}

export interface QuizType {
  quiz_type_id: number;
  type_name: string;
}

export interface QuizFacetedCount {
  cat_name: string;
  difficulty_name: string;
  type_name: string;
  count: number;
}

export interface QuizMetricsData {
  totalQuizzes: number;
  byCategory: {
    cat_id: number;
    cat_name: string;
    count: number;
    percentage: number;
  }[];
  byType: {
    quiz_type_id: number;
    type_name: string;
    count: number;
    percentage: number;
  }[];
  byDifficulty: {
    difficulty_id: number;
    difficulty_name: string;
    count: number;
    percentage: number;
  }[];
  bySection: { sec_id: number; sec_num: string; count: number }[];
  lowCoverageSections: { sec_id: number; sec_num: string; count: number }[];
  matrix: {
    cat_name: string;
    difficulties: { [diffName: string]: number };
    total: number;
  }[];
  facetedBreakdown: QuizFacetedCount[];
}

export interface QuizPayloadStructure {
  [key: string]: unknown;
  title?: string;
  answer?: string;
  correct_answer?: string;
  options?: string[];
  correct_index?: number;
  items?: string[];
  pairs?: { left: string; right: string }[];
  steps?: { prompt: string; template?: string; expected: string }[];
}

export interface UnitLessonCardStructure {
  [key: string]: unknown;
  lesson_card?: { lesson_format?: string; lesson_text?: string };
}

export interface QuizRow extends RowDataPacket {
  quiz_id: number;
  cat_id: number;
  sec_id?: number;
  difficulty_id: number;
  quiz_type_id: number;
  cat_name: string;
  sec_num?: string;
  difficulty_name: string;
  type_name: string;
  question_text: string;
  quiz_payload: QuizPayloadStructure;
}

export interface UnitRow extends RowDataPacket {
  unit_id: number;
  unit_title: string;
  sec_id: number;
  sec_num?: string;
  unit_lesson_card_json: unknown;
  quiz_json: unknown;
  assessment_json: unknown;
}

export interface AvailableUnit {
  pending_id: number;
  unit_id: number;
  unit_title: string;
  category_name?: string;
  sec_id?: number;
  sec_num?: string;
  unit_number?: number | string | null;
  quiz_count: number;
  has_coding_assessment?: boolean;
  sec_title?: string;
  difficulty_name?: string;
  unit_order?: number;
  is_locked?: boolean;
  is_completed?: boolean;
}

export interface CodeProblemStep {
  prompt: string;
  template: string;
  expected: string;
}

export interface CodeProblem {
  unit_id: number;
  unit_title: string;
  quiz_id?: number;
  question_text: string;
  instructions: string[];
  steps: CodeProblemStep[];
}

export interface RecentUnitItem {
  unit_id: number;
  unit_title: string;
  sec_id: number;
  unit_order: number;
  sec_num?: string | number;
  cat_id: number;
  cat_name: string;
  author_id: number | null;
  author_name: string;
  status: "pending" | "approved" | "rejected";
  pending_note: string | null;
  slide_count: number;
  question_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface UnitByIdPayload {
  quiz_id: number;
  unit_id: number;
  cat_id: number;
  sec_id: number;
  unit_order: number;
  difficulty_id: number;
  quiz_type_id: number;
  question_text: string;
  cat_name: string;
  sec_num?: string;
  difficulty_name: string;
  type_name: string;
  quiz_payload: {
    title: string;
    lesson_card: {
      lesson_title: string;
      lesson_slide: Array<{
        lesson_title: string;
        lesson_text: string;
        lesson_code: string;
      }>;
    };
    quizzes: QuizRow[];
    assessment: Record<string, unknown> | null;
    unit_number: unknown;
    pending_name: string;
    pending_status: string;
    pending_note: string | null;
  };
}

export interface SectionUnitBundleEntry {
  unit_id: number;
  unit_title: string;
  unit_order: number;
  sec_id: number;
  sec_num: number;
  sec_title: string;
  cat_id: number;
  cat_name: string;
  difficulty_id: number;
  difficulty_name: string;
  unitPayload: UnitByIdPayload;
}

export interface PendingUnit {
  pending_id: number;
  unit_id: number;
  unit_title: string;
  sec_id: number;
  unit_lesson_card_json: UnitLessonCardStructure;
  unit_quiz_json: unknown;
  unit_assessment_json?: unknown;
  pending_status: "pending" | "approved" | "rejected" | string;
  pending_name: string;
  pending_note?: string | null;
  sec_num?: string;
  question_text: string;
  cat_name: string;
  difficulty_name: string;
  type_name: string;
  quiz_payload: QuizPayloadStructure;
}
