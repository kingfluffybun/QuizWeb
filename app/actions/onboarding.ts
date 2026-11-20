"use server";

import {
  getOrCreateUserOnboardingState,
  resetUserOnboardingTutorial,
  type OnboardingTutorialState,
} from "@/lib/server/onboarding";
import { getSessionContext } from "@/lib/server/session";

export async function getUserOnboardingAction(): Promise<OnboardingTutorialState | null> {
  const ctx = await getSessionContext();
  if (!ctx.userId) return null;
  return getOrCreateUserOnboardingState(ctx.userId);
}

export async function resetUserOnboardingAction(): Promise<{
  success: boolean;
  state?: OnboardingTutorialState;
}> {
  const ctx = await getSessionContext();
  if (!ctx.userId) {
    return { success: false };
  }
  const state = await resetUserOnboardingTutorial(ctx.userId);
  return { success: true, state };
}
