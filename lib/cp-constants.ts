export const CP_FILE_KEYS = ["html", "css", "js"] as const;
export type CPFileKey = (typeof CP_FILE_KEYS)[number];

export const CP_FILE_LABELS: Record<CPFileKey, string> = {
  html: "index.html",
  css: "style.css",
  js: "script.js",
};

export interface CPFileBuffers {
  html: string;
  css: string;
  js: string;
}

export interface CPStep {
  stepNumber: number;
  instruction: string;
  starterCode: CPFileBuffers;
  expectedTemplate: CPFileBuffers;
  inheritPreviousCode: boolean;
  hint?: string;
}

/**
 * Public step payload hydrated to the browser in `/quiz-cp`.
 * Strictly omits `expectedTemplate` so answers are never leaked to the network tab.
 */
export interface PublicCPStep {
  stepNumber: number;
  instruction: string;
  starterCode: CPFileBuffers;
  inheritPreviousCode: boolean;
  hint?: string;
  /** Indicates which tabs expect non-empty code vs. must remain empty on this step */
  expectedNonEmptyTabs: Record<CPFileKey, boolean>;
}

export interface PublicCodeProblem {
  unit_id: number;
  unit_title: string;
  sec_id?: number;
  unit_order?: number;
  title: string;
  description: string;
  expected_outcome: string;
  steps: PublicCPStep[];
}

export function createEmptyFileBuffers(): CPFileBuffers {
  return { html: "", css: "", js: "" };
}

export function hasAnyNonEmptyBuffer(buffers: CPFileBuffers): boolean {
  return (
    buffers.html.trim().length > 0 ||
    buffers.css.trim().length > 0 ||
    buffers.js.trim().length > 0
  );
}

export function createDefaultCPStep(stepNumber: number): CPStep {
  return {
    stepNumber,
    instruction: "",
    starterCode: createEmptyFileBuffers(),
    expectedTemplate: createEmptyFileBuffers(),
    inheritPreviousCode: stepNumber > 1,
    hint: "",
  };
}

/**
 * Lightweight client-safe predicate to detect whether an assessment object
 * contains coding assessment steps without pulling Zod into client bundles.
 */
export function hasCodingAssessmentPayload(rawAssessment: unknown): boolean {
  if (!rawAssessment || typeof rawAssessment !== "object" || Array.isArray(rawAssessment)) {
    return false;
  }
  const record = rawAssessment as Record<string, unknown>;
  const candidateSteps = Array.isArray(record.cp_steps)
    ? record.cp_steps
    : Array.isArray(record.steps)
      ? record.steps
      : [];

  return candidateSteps.some((step) => {
    if (typeof step === "string") return step.trim().length > 0;
    if (step && typeof step === "object") {
      const s = step as Record<string, unknown>;
      return String(s.instruction ?? s.prompt ?? "").trim().length > 0;
    }
    return false;
  });
}
