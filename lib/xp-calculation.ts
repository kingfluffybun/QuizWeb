const difficultyMultipliers: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
};

export function calculateEarnedXp(
  isCorrect: boolean,
  difficultyId: number | undefined,
): number {
  if (!isCorrect) return 0;

  const difficultyMultiplier = difficultyMultipliers[difficultyId ?? 0] ?? 1;
  return 4 * difficultyMultiplier;
}

export function calculateQuizXp(
  baseXp: number,
  allQuestionsCorrect: boolean,
  currentStreak: number,
): number {
  const completionMultiplier = allQuestionsCorrect ? 3 : currentStreak >= 10 ? 2 : 1;
  return Math.round(baseXp * completionMultiplier);
}
