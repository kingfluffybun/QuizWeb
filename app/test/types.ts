export type QuizType = "MCQ" | "FITB" | "Order" | "Pair" | "CP" | string;
export type QuizStatus = "idle" | "correct" | "incorrect" | "finished";

export interface PairItem {
    left: string;
    right: string;
}

export interface QuizPayload {
    options?: string[];
    correct_index?: number;
    answer?: string;
    items?: string[];
    pairs?: PairItem[];
    template?: string;
    expected?: string;
}

export interface QuizData {
    type_name: QuizType;
    question_text: string;
    quiz_payload: QuizPayload;
}