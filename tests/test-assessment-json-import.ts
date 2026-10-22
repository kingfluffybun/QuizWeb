import assert from "node:assert/strict";
import {
  parseAssessmentImport,
  parseAssessmentOnlyImport,
  parseAssessmentBulkImport,
  quizPayloadMatchesType,
} from "../lib/assessment-json-import";

const validImport = {
  unit_assessment_json: {
    schemaVersion: 2,
    title: "HTML assessment",
    description: "Build a page",
    steps: [
      {
        stepNumber: 1,
        instruction: "Create a title.\nKeep this sentence on its own line.",
        starterCode: {
          html: "<main>\n  \n</main>\n",
          css: "",
          js: "",
        },
        expectedTemplate: {
          html: "<main>\n  <h1>####</h1>\n</main>\n",
          css: "",
          js: "",
        },
        inheritPreviousCode: false,
      },
    ],
    expected_outcome: "<main>\n  <h1>Example</h1>\n</main>\n",
  },
  unit_quiz_json: [
    {
      cat_id: 1,
      sec_id: 1,
      difficulty_id: 1,
      quiz_type_id: 1,
      question_text: "What does this code render?\n\n<main>Hi</main>",
      quiz_payload: {
        options: [
          "A heading",
          "The text Hi inside a main element",
          "An image",
          "Nothing",
        ],
        correct_index: 1,
      },
    },
  ],
};

const validResult = parseAssessmentBulkImport(JSON.stringify(validImport));
assert.equal(validResult.success, true);
if (!validResult.success) {
  throw new Error(validResult.errors.join("; "));
}

assert.equal(
  validResult.data.unit_assessment_json.steps[0].starterCode.html,
  "<main>\n  \n</main>\n",
);
assert.equal(
  validResult.data.unit_assessment_json.steps[0].instruction,
  "Create a title.\nKeep this sentence on its own line.",
);
assert.equal(
  validResult.data.unit_quiz_json[0].question_text,
  "What does this code render?\n\n<main>Hi</main>",
);
assert.equal(
  quizPayloadMatchesType(
    "MCQ",
    validResult.data.unit_quiz_json[0].quiz_payload,
  ),
  true,
);

const extraAssessmentField = structuredClone(validImport) as Record<
  string,
  unknown
>;
(
  extraAssessmentField.unit_assessment_json as Record<string, unknown>
).legacy_markdown = "# Step 1";
const strictResult = parseAssessmentBulkImport(
  JSON.stringify(extraAssessmentField),
);
assert.equal(strictResult.success, false);

const invalidAnswer = structuredClone(validImport);
invalidAnswer.unit_quiz_json[0].quiz_payload.correct_index = 4;
assert.equal(
  parseAssessmentBulkImport(JSON.stringify(invalidAnswer)).success,
  false,
);
assert.equal(
  parseAssessmentBulkImport("{").success,
  false,
);

const assessmentOnly = parseAssessmentOnlyImport(
  JSON.stringify({
    unit_assessment_json: validImport.unit_assessment_json,
  }),
);
assert.equal(assessmentOnly.success, true);
if (assessmentOnly.success) {
  assert.equal(assessmentOnly.data.title, "HTML assessment");
  assert.equal(assessmentOnly.data.steps.length, 1);
}

const assessmentOnlyWithQuizField = parseAssessmentOnlyImport(
  JSON.stringify({
    unit_assessment_json: validImport.unit_assessment_json,
    unit_quiz_json: "ignored quiz data",
  }),
);
assert.equal(assessmentOnlyWithQuizField.success, false);
const inferredAssessmentOnly = parseAssessmentImport(
  JSON.stringify({
    unit_assessment_json: validImport.unit_assessment_json,
  }),
);
assert.equal(
  inferredAssessmentOnly.success && inferredAssessmentOnly.mode,
  "assessment-only",
);
const inferredFullImport = parseAssessmentImport(JSON.stringify(validImport));
assert.equal(
  inferredFullImport.success && inferredFullImport.mode,
  "full",
);
assert.equal(
  parseAssessmentImport(
    JSON.stringify({
      unit_assessment_json: validImport.unit_assessment_json,
      unexpected: true,
    }),
  ).success,
  false,
);

const allQuestionTypes = structuredClone(validImport);
allQuestionTypes.unit_quiz_json.push(
  {
    cat_id: 1,
    difficulty_id: 1,
    quiz_type_id: 2,
    question_text: "Complete the code.",
    quiz_payload: { answer: "return value;" },
  },
  {
    cat_id: 1,
    difficulty_id: 1,
    quiz_type_id: 3,
    question_text: "Put these steps in order.",
    quiz_payload: { items: ["first", "second", "third", "fourth"] },
  },
  {
    cat_id: 1,
    difficulty_id: 1,
    quiz_type_id: 4,
    question_text: "Match each item.",
    quiz_payload: {
      pairs: [
        { left: "A", right: "1" },
        { left: "B", right: "2" },
        { left: "C", right: "3" },
        { left: "D", right: "4" },
      ],
    },
  },
  {
    cat_id: 1,
    difficulty_id: 1,
    quiz_type_id: 5,
    question_text: "Write the markup.",
    quiz_payload: {
      title: "Markup",
      steps: [
        {
          prompt: "Add a heading.",
          template: "<main>\n  \n</main>",
          expected: "<main>\n  <h1>Hello</h1>\n</main>",
        },
      ],
      prompts: ["Add a heading."],
      prompt: "Add a heading.",
      template: "<main>\n  \n</main>",
      expected: "<main>\n  <h1>Hello</h1>\n</main>",
    },
  },
);
const allTypesResult = parseAssessmentBulkImport(
  JSON.stringify(allQuestionTypes),
);
assert.equal(allTypesResult.success, true);
if (allTypesResult.success) {
  const codePayload = allTypesResult.data.unit_quiz_json[4].quiz_payload;
  assert.equal(
    "steps" in codePayload ? codePayload.steps[0].template : undefined,
    "<main>\n  \n</main>",
  );
}
