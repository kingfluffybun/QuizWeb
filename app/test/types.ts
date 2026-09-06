export type QuizType = "MCQ" | "FITB" | "Order" | "Pair" | "CP" | string;
export type QuizStatus = "idle" | "correct" | "incorrect" | "finished";

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
}

export interface QuizData {
    type_name: QuizType;
    question_text: string;
    quiz_payload: QuizPayload;
}