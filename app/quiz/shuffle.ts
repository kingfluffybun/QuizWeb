import type { QuizData } from "@/app/quiz/types";

/** Deterministic PRNG (Mulberry32) so seeded shuffles stay SSR/client consistent. */
function nextRandom(state: { value: number }): number {
  state.value = (state.value + 0x6d2b79f5) | 0;
  let t = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffleItems<T>(items: T[], seed?: number): T[] {
  const shuffled = items.map((value, index) => ({ value, index }));
  const state = seed !== undefined ? { value: seed | 0 } : null;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const rand = state ? nextRandom(state) : Math.random();
    const randomIndex = Math.floor(rand * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  if (
    shuffled.length > 1 &&
    shuffled.every((item, index) => item.index === index)
  ) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled.map(({ value }) => value);
}

export function shuffleQuizOptions(
  quiz: QuizData,
  shouldShuffle = true,
): QuizData {
  const { options, correct_index: correctIndex } = quiz.quiz_payload;

  if (!shouldShuffle || quiz.type_name !== "MCQ" || !options || options.length < 2) {
    return quiz;
  }

  const shuffled = shuffleItems(
    options.map((text, index) => ({ text, index })),
  );
  const nextCorrectIndex =
    typeof correctIndex === "number"
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
