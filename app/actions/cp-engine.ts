"use server";

import {
  CPFileBuffersSchema,
  toPublicCodeProblem,
  type CPFileBuffers,
  type PublicCodeProblem,
} from "@/lib/cp-schema";
import {
  validateCodeProblemStep,
  type StepValidationResult,
} from "@/lib/cp-validator";
import { resolveAuthoritativeAssessment } from "@/lib/server/cp-assessment";
import { isUnitUnlockedForUserImpl } from "@/lib/server/progress/unlock";

/**
 * Fetches the public Code Problem definition for `/quiz-cp`, stripping all `expectedTemplate` fields
 * so answers are never exposed in the browser network tab.
 */
export async function getPublicCodeProblem(
  unitId?: number,
): Promise<PublicCodeProblem | null> {
  if (unitId && Number.isInteger(unitId) && unitId > 0) {
    const isUnlocked = await isUnitUnlockedForUserImpl(unitId);
    if (!isUnlocked) {
      return null;
    }
  }

  const resolved = await resolveAuthoritativeAssessment(unitId);
  if (!resolved) return null;

  return toPublicCodeProblem(
    resolved.resolvedUnitId,
    resolved.unitTitle,
    resolved.assessment,
  );
}

/**
 * Server Action that grades a student's `{ html, css, js }` buffers for `stepIndex`
 * against the private `expectedTemplate` stored in MySQL.
 */
export async function verifyCodeProblemStep(input: {
  unitId: number;
  stepIndex: number;
  studentCode: CPFileBuffers;
}): Promise<
  StepValidationResult & {
    isFinalStep: boolean;
    nextStepIndex: number;
    totalSteps: number;
  }
> {
  const parsedBuffers = CPFileBuffersSchema.safeParse(input?.studentCode);
  if (!parsedBuffers.success) {
    return {
      passed: false,
      message: "Invalid code submission payload.",
      isFinalStep: false,
      nextStepIndex: input?.stepIndex ?? 0,
      totalSteps: 0,
      tabResults: {} as StepValidationResult["tabResults"],
    };
  }

  const resolved = await resolveAuthoritativeAssessment(input.unitId);
  if (!resolved) {
    return {
      passed: false,
      message: "Coding assessment was not found for this unit.",
      isFinalStep: false,
      nextStepIndex: 0,
      totalSteps: 0,
      tabResults: {} as StepValidationResult["tabResults"],
    };
  }

  const { steps } = resolved.assessment;
  const stepIndex = Number(input.stepIndex);
  if (
    !Number.isInteger(stepIndex) ||
    stepIndex < 0 ||
    stepIndex >= steps.length
  ) {
    return {
      passed: false,
      message: "Invalid assessment step number.",
      isFinalStep: false,
      nextStepIndex: 0,
      totalSteps: steps.length,
      tabResults: {} as StepValidationResult["tabResults"],
    };
  }

  const targetStep = steps[stepIndex];
  const result = validateCodeProblemStep(
    parsedBuffers.data,
    targetStep.expectedTemplate,
  );

  const isFinalStep = stepIndex === steps.length - 1;
  return {
    ...result,
    isFinalStep,
    nextStepIndex: result.passed && !isFinalStep ? stepIndex + 1 : stepIndex,
    totalSteps: steps.length,
  };
}
