const difficultyMultipliers: Record<number, number> = {
  1: 1,
  2: 1.5,
  3: 3,
};

export interface XpCalculationBreakdown {
  isCorrect: boolean;
  currentStreak: number;
  baseXp: number;
  difficultyMultiplier: number;
  streakMultiplier: number;
  earnedXp: number;
}

export function calculateXpBreakdown(
  isCorrect: boolean,
  difficultyId: number | undefined,
  currentStreak: number,
): XpCalculationBreakdown {
  const difficultyMultiplier = difficultyMultipliers[difficultyId ?? 0] ?? 1;
  const streakMultiplier = isCorrect
    ? 1 + (currentStreak - 1) * 0.1
    : 1;

  return {
    isCorrect,
    currentStreak: isCorrect ? currentStreak : 0,
    baseXp: 10,
    difficultyMultiplier,
    streakMultiplier,
    earnedXp: isCorrect ? 10 * difficultyMultiplier * streakMultiplier : 0,
  };
}

export function calculateEarnedXp(
  isCorrect: boolean,
  difficultyId: number | undefined,
  currentStreak: number,
): number {
  return calculateXpBreakdown(isCorrect, difficultyId, currentStreak).earnedXp;
}
