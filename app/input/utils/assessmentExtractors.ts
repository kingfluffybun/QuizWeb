import type { CPFileBuffers, CPStep } from "@/lib/cp-constants";
import { unwrapCodeProblemAssessment } from "@/lib/cp-schema";

export function createProgressiveCPStep(
  stepNumber: number,
  previousExpected?: CPFileBuffers,
): CPStep {
  return {
    stepNumber,
    instruction: "",
    starterCode: { html: "", css: "", js: "" },
    expectedTemplate: previousExpected
      ? {
          html: previousExpected.html,
          css: previousExpected.css,
          js: previousExpected.js,
        }
      : { html: "", css: "", js: "" },
    inheritPreviousCode: stepNumber > 1,
  };
}

export function getAssessmentSteps(value: unknown): string[] {
  if (Array.isArray(value)) {
    const steps = value.filter((step): step is string => typeof step === "string");
    return steps.length > 0 ? steps : [""];
  }

  if (value && typeof value === "object") {
    const assessment = value as { steps?: unknown; assessment?: unknown };
    if (Array.isArray(assessment.steps)) {
      return getAssessmentSteps(assessment.steps);
    }
    return getAssessmentSteps(assessment.assessment);
  }

  return [typeof value === "string" ? value : ""];
}

export function getExpectedOutcome(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const expectedOutcome = (value as { expected_outcome?: unknown }).expected_outcome;
  return typeof expectedOutcome === "string" ? expectedOutcome : "";
}

export function getAssessmentTitle(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const title = (value as { title?: unknown }).title;
  return typeof title === "string" ? title : "";
}

export function getAssessmentDescription(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const description = (value as { description?: unknown }).description;
  return typeof description === "string" ? description : "";
}

export function getAssessmentCPSteps(value: unknown): CPStep[] {
  if (
    value &&
    typeof value === "object" &&
    "cp_steps" in value &&
    Array.isArray((value as { cp_steps?: unknown }).cp_steps)
  ) {
    return (value as { cp_steps: CPStep[] }).cp_steps;
  }

  const unwrapped = unwrapCodeProblemAssessment(value);
  if (unwrapped && unwrapped.steps.length > 0) {
    return unwrapped.steps;
  }

  const plainSteps = getAssessmentSteps(value);
  const expectedOut = getExpectedOutcome(value);
  return plainSteps.map((instruction, idx) => ({
    ...createProgressiveCPStep(idx + 1),
    instruction,
    expectedTemplate: {
      html: idx === plainSteps.length - 1 ? expectedOut : "",
      css: "",
      js: "",
    },
  }));
}
