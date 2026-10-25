import { z } from "zod";

export const CP_FILE_KEYS = ["html", "css", "js"] as const;
export type CPFileKey = (typeof CP_FILE_KEYS)[number];

export const CP_FILE_LABELS: Record<CPFileKey, string> = {
  html: "index.html",
  css: "style.css",
  js: "script.js",
};

export const CPFileBuffersSchema = z.object({
  html: z.string().default(""),
  css: z.string().default(""),
  js: z.string().default(""),
});

export type CPFileBuffers = z.infer<typeof CPFileBuffersSchema>;

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
  .superRefine((step, ctx) => {
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
  });

export type CPStep = z.infer<typeof CPStepSchema>;

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
  .superRefine((assessment, ctx) => {
    assessment.steps.forEach((step, index) => {
      if (step.stepNumber !== index + 1) {
        ctx.addIssue({
          code: "custom",
          path: ["steps", index, "stepNumber"],
          message: `Step numbers must be sequential (expected ${index + 1}, got ${step.stepNumber}).`,
        });
      }
    });
  });

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
    if (step.inheritPreviousCode === undefined) {
      step.inheritPreviousCode =
        typeof step.stepNumber === "number" ? step.stepNumber > 1 : true;
    }
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
    .superRefine((step, ctx) => {
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
    }),
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
        record.schemaVersion = 2;
      }
    }
    return record;
  },
  z
    .strictObject({
      schemaVersion: z.literal(2),
      title: z.string(),
      description: z.string(),
      steps: z.array(ImportCPStepSchema).min(1).max(20),
      expected_outcome: z.string(),
      cp_steps: z.array(z.unknown()).optional(),
      assessment: z.string().optional(),
    })
    .superRefine((assessment, ctx) => {
      assessment.steps.forEach((step, index) => {
        if (step.stepNumber !== index + 1) {
          ctx.addIssue({
            code: "custom",
            path: ["steps", index, "stepNumber"],
            message: `Step numbers must be sequential (expected ${index + 1}, got ${step.stepNumber}).`,
          });
        }
      });
    }),
);

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
  title: string;
  description: string;
  expected_outcome: string;
  steps: PublicCPStep[];
}


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

  // 1. Check if v2 structured step objects exist (`cp_steps` or `steps` of objects)
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

      // Only include step if it has an instruction; if expectedTemplate is completely empty
      // in a legacy row, fall back to expectedOutcome so old data doesn't crash on read.
      const safeExpected = hasAnyNonEmptyBuffer(expectedTemplate)
        ? expectedTemplate
        : { html: expectedOutcome || instruction, css: "", js: "" };

      normalizedSteps.push({
        stepNumber: idx + 1,
        instruction,
        starterCode,
        expectedTemplate: safeExpected,
        inheritPreviousCode:
          typeof stepObj.inheritPreviousCode === "boolean"
            ? stepObj.inheritPreviousCode
            : idx > 0,
        ...(typeof stepObj.hint === "string" && stepObj.hint.trim()
          ? { hint: stepObj.hint.trim() }
          : {}),
      });
    });
  } else if (rawStepsCandidate.length > 0) {
    // 2. Legacy string[] steps format (`{ title, description, steps: string[], expected_outcome }`)
    const stringSteps = rawStepsCandidate
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean);

    if (stringSteps.length > 0 && expectedOutcome) {
      stringSteps.forEach((instruction, idx) => {
        normalizedSteps.push({
          stepNumber: idx + 1,
          instruction,
          starterCode: createEmptyFileBuffers(),
          expectedTemplate: {
            html: expectedOutcome,
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
  const lastStep = validated.steps[validated.steps.length - 1];
  const fallbackOutcome =
    validated.expected_outcome.trim() ||
    lastStep?.expectedTemplate.html ||
    lastStep?.expectedTemplate.css ||
    lastStep?.expectedTemplate.js ||
    "";

  return {
    schemaVersion: 2 as const,
    title: validated.title,
    description: validated.description,
    assessment: plainInstructions.join("\n\n"),
    steps: plainInstructions,
    cp_steps: validated.steps,
    expected_outcome: fallbackOutcome,
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
