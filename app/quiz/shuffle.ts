import type { QuizData } from "@/app/quiz/types";

export function shuffleItems<T>(items: T[]): T[] {
    const shuffled = items.map((value, index) => ({ value, index }));

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    if (
        shuffled.length > 1 &&
        shuffled.every((item, index) => item.index === index)
    ) {
        [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }

    return shuffled.map(({ value }) => value);
}

export function shuffleQuizOptions(quiz: QuizData): QuizData {
    const { options, correct_index: correctIndex } = quiz.quiz_payload;

    if (quiz.type_name !== "MCQ" || !options || options.length < 2) {
        return quiz;
    }

    const shuffled = shuffleItems(options.map((text, index) => ({ text, index })));
    const nextCorrectIndex = typeof correctIndex === "number"
        ? shuffled.findIndex((option) => option.index === correctIndex)
        : correctIndex;

    return {
        ...quiz,
        quiz_payload: {
            ...quiz.quiz_payload,
            options: shuffled.map((option) => option.text),
            correct_index: nextCorrectIndex,
        },
    };
}
