import { z } from "zod";
import {
  CP_FILE_KEYS,
  CP_FILE_LABELS,
  createEmptyFileBuffers,
  hasAnyNonEmptyBuffer,
  createDefaultCPStep,
  hasCodingAssessmentPayload,
  type CPFileKey,
  type CPFileBuffers,
  type CPStep,
  type PublicCPStep,
  type PublicCodeProblem,
} from "./cp-constants";

export {
  CP_FILE_KEYS,
  CP_FILE_LABELS,
  createEmptyFileBuffers,
  hasAnyNonEmptyBuffer,
  createDefaultCPStep,
  hasCodingAssessmentPayload,
  type CPFileKey,
  type CPFileBuffers,
  type CPStep,
  type PublicCPStep,
  type PublicCodeProblem,
};

export const CPFileBuffersSchema = z.object({
  html: z.string().default(""),
  css: z.string().default(""),
  js: z.string().default(""),
});

function validateCPStepRules(
  step: { stepNumber: number; expectedTemplate: CPFileBuffers },
  ctx: z.RefinementCtx,
) {
  if (!hasAnyNonEmptyBuffer(step.expectedTemplate)) {
    ctx.addIssue({
      code: "custom",
      path: ["expectedTemplate"],
      message: `Step ${step.stepNumber}: At least one tab (index.html, style.css, or script.js) must have a non-empty expected template.`,
    });
  }

  for (const key of CP_FILE_KEYS) {
    if (step.expectedTemplate[key].includes("########")) {
      ctx.addIssue({
        code: "custom",
        path: ["expectedTemplate", key],
        message: `Step ${step.stepNumber} (${CP_FILE_LABELS[key]}): Adjacent '########' wildcards are ambiguous; separate wildcards with literal tokens.`,
      });
    }
  }
}

function validateSequentialSteps(
  assessment: { steps: Array<{ stepNumber: number }> },
  ctx: z.RefinementCtx,
) {
  assessment.steps.forEach((step, index) => {
    if (step.stepNumber !== index + 1) {
      ctx.addIssue({
        code: "custom",
        path: ["steps", index, "stepNumber"],
        message: `Step numbers must be sequential (expected ${index + 1}, got ${step.stepNumber}).`,
      });
    }
  });
}

export const CPStepSchema = z
  .object({
    stepNumber: z.number().int().min(1),
    instruction: z
      .string()
      .trim()
      .min(1, "Step instruction is required."),
    starterCode: CPFileBuffersSchema.default({
      html: "",
      css: "",
      js: "",
    }),
    expectedTemplate: CPFileBuffersSchema.default({
      html: "",
      css: "",
      js: "",
    }),
    inheritPreviousCode: z.boolean().default(true),
    hint: z.string().trim().optional(),
  })
  .superRefine(validateCPStepRules);

export const CodeProblemAssessmentSchema = z
  .object({
    schemaVersion: z.literal(2).default(2),
    title: z.string().trim().default(""),
    description: z.string().trim().default(""),
    steps: z
      .array(CPStepSchema)
      .min(1, "At least one step is required for a coding assessment.")
      .max(20, "A coding assessment can have at most 20 steps."),
    expected_outcome: z.string().trim().default(""),
  })
  .superRefine(validateSequentialSteps);

export type CodeProblemAssessment = z.infer<typeof CodeProblemAssessmentSchema>;

const ImportTextSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "Text is required.",
});

export function coerceFileBuffers(raw: unknown, defaultHtml = ""): CPFileBuffers {
  if (typeof raw === "string") {
    return { html: raw, css: "", js: "" };
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    return {
      html: typeof record.html === "string" ? record.html : defaultHtml,
      css: typeof record.css === "string" ? record.css : "",
      js: typeof record.js === "string" ? record.js : "",
    };
  }
  return { html: defaultHtml, css: "", js: "" };
}

const ImportFileBuffersSchema = z.strictObject({
  html: z.string(),
  css: z.string(),
  js: z.string(),
});

export const ImportCPStepSchema = z.preprocess(
  (rawStep) => {
    if (!rawStep || typeof rawStep !== "object") return rawStep;
    const step = { ...(rawStep as Record<string, unknown>) };
    if (!step.instruction && typeof step.prompt === "string") {
      step.instruction = step.prompt;
    }
    if (step.starterCode !== undefined) {
      step.starterCode = coerceFileBuffers(step.starterCode);
    } else if (step.starter !== undefined || step.template !== undefined) {
      step.starterCode = coerceFileBuffers(step.starter ?? step.template);
    }
    if (step.expectedTemplate !== undefined) {
      step.expectedTemplate = coerceFileBuffers(step.expectedTemplate);
    } else if (step.expected !== undefined) {
      step.expectedTemplate = coerceFileBuffers(step.expected);
    }
    if (step.stepNumber === undefined && typeof step.step_number === "number") {
      step.stepNumber = step.step_number;
    }
    if (step.inheritPreviousCode === undefined) {
      step.inheritPreviousCode =
        typeof step.stepNumber === "number" ? step.stepNumber > 1 : true;
    }
    delete step.prompt;
    delete step.starter;
    delete step.template;
    delete step.expected;
    delete step.step_number;
    delete step.step_id;
    delete step.assessment_id;
    return step;
  },
  z
    .strictObject({
      stepNumber: z.number().int().min(1),
      instruction: ImportTextSchema,
      starterCode: ImportFileBuffersSchema,
      expectedTemplate: ImportFileBuffersSchema,
      inheritPreviousCode: z.boolean(),
      hint: z.string().optional(),
    })
    .superRefine(validateCPStepRules),
);

export const CodeProblemAssessmentImportSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return raw;
    }
    const record = { ...(raw as Record<string, unknown>) };
    const hasCpSteps =
      Array.isArray(record.cp_steps) && record.cp_steps.length > 0;
    const stepsIsStrings =
      Array.isArray(record.steps) &&
      record.steps.length > 0 &&
      typeof record.steps[0] === "string";

    if (hasCpSteps && (!record.steps || stepsIsStrings)) {
      record.steps = record.cp_steps;
    } else if (stepsIsStrings && !hasCpSteps) {
      const unwrapped = unwrapCodeProblemAssessment(record);
      if (unwrapped) {
        record.steps = unwrapped.steps;
        if (!record.expected_outcome) {
          record.expected_outcome = unwrapped.expected_outcome;
        }
        record.schemaVersion = 2;
      }
    }
    if (Array.isArray(record.steps)) {
      record.steps = record.steps.map((st, i) => {
        if (st && typeof st === "object") {
          const s = { ...(st as Record<string, unknown>) };
          if (s.stepNumber === undefined && s.step_number === undefined) {
            s.stepNumber = i + 1;
          }
          return s;
        }
        return st;
      });
    }
    delete record.status;
    delete record.unit_id;
    delete record.assessment_id;
    delete record.author_id;
    delete record.created_at;
    delete record.updated_at;
    return record;
  },
  z
    .strictObject({
      schemaVersion: z.literal(2).default(2),
      title: z.string().default(""),
      description: z.string().default(""),
      steps: z.array(ImportCPStepSchema).min(1).max(20),
      expected_outcome: z.string().default(""),
      cp_steps: z.array(z.unknown()).optional(),
      assessment: z.string().optional(),
    })
    .superRefine(validateSequentialSteps),
);

/**
 * Safely unwraps raw MySQL JSON (`unit_assessment_json` or `quiz_payload`) into a
 * strongly-typed `CodeProblemAssessment`, seamlessly adapting legacy v1 formats.
 */
export function unwrapCodeProblemAssessment(
  rawInput: unknown,
  fallbackTitle = "",
): CodeProblemAssessment | null {
  if (rawInput === null || rawInput === undefined) return null;

  let parsed: unknown = rawInput;
  if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;

  const rawStepsCandidate = Array.isArray(record.cp_steps)
    ? record.cp_steps
    : Array.isArray(record.steps)
      ? record.steps
      : [];

  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : fallbackTitle;
  const description =
    typeof record.description === "string" ? record.description.trim() : "";
  const expectedOutcome =
    typeof record.expected_outcome === "string"
      ? record.expected_outcome.trim()
      : typeof record.expected === "string"
        ? record.expected.trim()
        : "";

  const normalizedSteps: CPStep[] = [];

  if (
    rawStepsCandidate.length > 0 &&
    typeof rawStepsCandidate[0] === "object" &&
    rawStepsCandidate[0] !== null
  ) {
    rawStepsCandidate.forEach((rawStep, idx) => {
      if (!rawStep || typeof rawStep !== "object") return;
      const stepObj = rawStep as Record<string, unknown>;
      const instruction = String(
        stepObj.instruction ?? stepObj.prompt ?? "",
      ).trim();
      if (!instruction) return;

      const starterCode = coerceFileBuffers(
        stepObj.starterCode ?? stepObj.starter ?? stepObj.template,
      );
      const expectedTemplate = coerceFileBuffers(
        stepObj.expectedTemplate ?? stepObj.expected,
        idx === rawStepsCandidate.length - 1 ? expectedOutcome : "",
      );

      const safeExpected = hasAnyNonEmptyBuffer(expectedTemplate)
        ? expectedTemplate
        : { html: expectedOutcome || instruction, css: "", js: "" };

      const nextStepNumber = normalizedSteps.length + 1;
      normalizedSteps.push({
        stepNumber: nextStepNumber,
        instruction,
        starterCode,
        expectedTemplate: safeExpected,
        inheritPreviousCode:
          typeof stepObj.inheritPreviousCode === "boolean"
            ? stepObj.inheritPreviousCode
            : nextStepNumber > 1,
        ...(typeof stepObj.hint === "string" && stepObj.hint.trim()
          ? { hint: stepObj.hint.trim() }
          : {}),
      });
    });
  } else if (rawStepsCandidate.length > 0) {
    const stringSteps = rawStepsCandidate
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean);

    if (stringSteps.length > 0) {
      const outcomeHtml =
        expectedOutcome || `<main>\n  <!-- Assessment Step -->\n</main>`;
      stringSteps.forEach((instruction, idx) => {
        normalizedSteps.push({
          stepNumber: idx + 1,
          instruction,
          starterCode: createEmptyFileBuffers(),
          expectedTemplate: {
            html: outcomeHtml,
            css: "",
            js: "",
          },
          inheritPreviousCode: idx > 0,
        });
      });
    }
  }

  if (normalizedSteps.length === 0) {
    return null;
  }

  // Never copy expectedTemplate solution code into expected_outcome when blank,
  // because expected_outcome is sent to the browser in PublicCodeProblem.
  const candidate: CodeProblemAssessment = {
    schemaVersion: 2,
    title,
    description,
    steps: normalizedSteps,
    expected_outcome: expectedOutcome,
  };

  const result = CodeProblemAssessmentSchema.safeParse(candidate);
  return result.success ? result.data : candidate;
}

/**
 * Wraps a `CodeProblemAssessment` into a backward-compatible JSON object for MySQL storage
 * (`unit_assessment_json`), preserving `steps: string[]` and `assessment: string` for legacy views
 * while storing full multi-step `cp_steps` and `schemaVersion: 2`.
 */
export function wrapCodeProblemAssessmentForStorage(
  input: CodeProblemAssessment,
) {
  const validated = CodeProblemAssessmentSchema.parse(input);
  const plainInstructions = validated.steps.map((s) => s.instruction);

  return {
    schemaVersion: 2 as const,
    title: validated.title,
    description: validated.description,
    assessment: plainInstructions.join("\n\n"),
    steps: plainInstructions,
    cp_steps: validated.steps,
    expected_outcome: validated.expected_outcome.trim(),
  };
}

/**
 * Strips `expectedTemplate` from a `CodeProblemAssessment` to produce a safe client payload.
 */
export function toPublicCodeProblem(
  unitId: number,
  unitTitle: string,
  assessment: CodeProblemAssessment,
): PublicCodeProblem {
  return {
    unit_id: unitId,
    unit_title: unitTitle,
    title: assessment.title || unitTitle,
    description: assessment.description,
    expected_outcome: assessment.expected_outcome,
    steps: assessment.steps.map((step) => ({
      stepNumber: step.stepNumber,
      instruction: step.instruction,
      starterCode: { ...step.starterCode },
      inheritPreviousCode: step.inheritPreviousCode,
      ...(step.hint ? { hint: step.hint } : {}),
      expectedNonEmptyTabs: {
        html: step.expectedTemplate.html.trim().length > 0,
        css: step.expectedTemplate.css.trim().length > 0,
        js: step.expectedTemplate.js.trim().length > 0,
      },
    })),
  };
}
