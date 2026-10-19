export type QuizType = "MCQ" | "FITB" | "Order" | "Pair" | "CP" | string;
export type QuizStatus = "idle" | "correct" | "incorrect" | "assessment" | "finished";

export interface PairItem {
    left: string;
    right: string;
}

export interface CPStep {
    prompt: string;
    template?: string;
    expected: string;
}

export interface CPQuestion {
    template?: string;
    prompt?: string;
    expected?: string;
    steps?: CPStep[];
}

export interface QuizPayload {
    [key: string]: unknown;
    options?: string[];
    correct_index?: number;
    answer?: string;
    items?: string[];
    pairs?: PairItem[];
    questions?: CPQuestion[];
    steps?: CPStep[];
    template?: string;
    expected?: string;
    prompts?: string[];
    prompt?: string;
    assessment?: {
        title?: string;
        description?: string;
        assessment?: string;
        steps?: string[];
        expected_outcome?: string;
    } | string;
    lesson_card?: Record<string, unknown>;
    quizzes?: QuizData[];
}

export interface QuizData {
    quiz_id?: number;
    cat_id?: number;
    sec_id?: number;
    difficulty_id?: number;
    quiz_type_id?: number;
    cat_name?: string;
    sec_num?: string;
    difficulty_name?: string;
    type_name: QuizType;
    question_text: string;
    quiz_payload: QuizPayload;
    unit_title?: string;
    unit_lesson_card?: UnitLessonCardData;
    unit_assessment?: Record<string, unknown> | string;
}

export interface LessonSlideItem {
    lesson_title?: string;
    lesson_text?: string;
    lesson_code?: string;
}

export interface UnitLessonCardData {
    lesson_title?: string;
    lesson_text?: string;
    lesson_code?: string;
    lesson_slide?: LessonSlideItem[];
    lesson_card?: {
        lesson_text?: string;
    };
    [key: string]: unknown;
}

export interface PairAnswer {
    left: string[];
    right: string[];
}

export type QuizAnswer = number | string | string[] | PairAnswer | null;

export interface McqOption {
    id: number;
    text: string;
}

export interface McqQuizState {
    options: McqOption[];
    correctId: number;
}

export type QuizCustomState = McqQuizState | null;