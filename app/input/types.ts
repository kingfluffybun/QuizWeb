import type {
  Category,
  Difficulty,
  QuizMetricsData,
  QuizType,
  RecentUnitItem,
} from "@/app/actions/quiz";

export interface SavedLessonSlide {
  lesson_text?: string;
  text?: string;
  lesson_title?: string;
  title?: string;
  lesson_code?: string;
  code?: string;
}

export interface LessonSlideState {
  text: string;
  title?: string;
  code?: string;
}

export interface CPQuestionStepState {
  prompt: string;
  template: string;
  expected: string;
}

export interface QuizPayload {
  title?: string;
  options?: string[];
  correct_index?: number;
  answer?: string;
  items?: string[];
  pairs?: { left: string; right: string }[];
  steps?: { prompt?: string; template?: string; expected?: string }[];
  prompts?: string[];
  template?: string;
  expected?: string;
  quizzes?: QueuedQuizEntry[];
  lesson_card?: {
    lesson_slide?: SavedLessonSlide[];
    lesson_slides?: SavedLessonSlide[];
    lesson_text?: string;
    lesson_title?: string;
    lesson_code?: string;
    lesson_card?: { lesson_text?: string };
    [key: string]: unknown;
  };
  lesson_text?: string;
  assessment?:
    | string
    | {
        assessment?: string;
        title?: string;
        description?: string;
        steps?: string[];
        expected_outcome?: string;
        [key: string]: unknown;
      };
  [key: string]: unknown;
}

export type QueuedQuizEntry = {
  cat_id?: number;
  sec_id?: number;
  unit?: number;
  difficulty_id?: number;
  quiz_type_id?: number | string;
  question_text?: string;
  quiz_payload?: Record<string, unknown>;
};

export interface RecentQuizItem {
  quiz_id: number;
  unit_id?: number;
  pending_id?: number;
  pending_status?: string;
  unit_order?: number;
  cat_id?: number;
  sec_id?: number;
  difficulty_id?: number;
  quiz_type_id?: number | string;
  cat_name?: string;
  sec_num?: string | number;
  difficulty_name?: string;
  type_name?: string;
  question_text?: string;
  quiz_payload?: QuizPayload | null;
}

export interface EditingQuizItem extends Omit<RecentQuizItem, "quiz_id"> {
  quiz_id?: number;
  unit_id?: number;
  pending_id?: number;
  pending_status?: string;
  unit?: number;
  unit_assessment?: unknown;
  _pendingUnit?: boolean;
  _queuedUnitQuiz?: boolean;
}

export interface QuizInputFormProps {
  categories: Category[];
  difficulties: Difficulty[];
  types: QuizType[];
  sections?: { sec_id: number; sec_num: string; cat_id?: number }[];
  initialRecentUnits?: RecentUnitItem[];
  initialRecentQuizzes?: RecentQuizItem[];
  initialPage: number;
  initialTotalPages: number;
  initialTotalCount: number;
  initialMetrics?: QuizMetricsData;
  showRecentQuizzes?: boolean;
  initialEditingQuiz?: EditingQuizItem | null;
}

export type UnitInputTab = "unit" | "lesson" | "quiz" | "assessment" | "import";
export type PreviewTab = "lesson" | "assessment";

export interface StatusMessage {
  type: "success" | "error";
  text: string;
}

export interface SectionOption {
  sec_id: number;
  sec_num: string;
  cat_id?: number;
}
