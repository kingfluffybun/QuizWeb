const difficultyMultipliers: Record<number, number> = {
  1: 1,
  2: 1.5,
  3: 3,
};

export function calculateEarnedXp(
  isCorrect: boolean,
  difficultyId: number | undefined,
  currentStreak: number,
): number {
  if (!isCorrect) return 0;

  const difficultyMultiplier = difficultyMultipliers[difficultyId ?? 0] ?? 1;
  const streakMultiplier = 1 + (currentStreak - 1) * 0.1;
  return 10 * difficultyMultiplier * streakMultiplier;
}
