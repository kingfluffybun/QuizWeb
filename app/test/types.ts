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
    assessment?: { assessment?: string } | string;
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
}