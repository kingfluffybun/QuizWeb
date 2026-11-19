import type { Category, Difficulty, QuizType } from "@/app/actions/quiz";
import type {
  CPQuestionStepState,
  EditingQuizItem,
  QueuedQuizEntry,
  SectionOption,
  UnitInputTab,
} from "../types";

export interface BuildQuizEntryParams {
  categories: Category[];
  sections: SectionOption[];
  difficulties: Difficulty[];
  types: QuizType[];
  selectedCatId: string;
  selectedSecId: string;
  selectedDiffId: string;
  selectedTypeId: string;
  selectedTypeName: string;
  selectedUnit: string;
  unitInputTab: UnitInputTab;
  questionText: string;
  mcqOptions: string[];
  mcqCorrectIndex: number;
  fitbAnswer: string;
  orderItems: string[];
  pairValues: { left: string; right: string }[];
  cpQuizSteps: CPQuestionStepState[];
  editingQuiz: EditingQuizItem | null;
}

export function buildQuizEntryFromState(
  params: BuildQuizEntryParams,
): QueuedQuizEntry {
  const {
    categories,
    sections,
    difficulties,
    types,
    selectedCatId,
    selectedSecId,
    selectedDiffId,
    selectedTypeId,
    selectedTypeName,
    selectedUnit,
    unitInputTab,
    questionText,
    mcqOptions,
    mcqCorrectIndex,
    fitbAnswer,
    orderItems,
    pairValues,
    cpQuizSteps,
    editingQuiz,
  } = params;

  const typeName =
    selectedTypeName ||
    types.find((t) => t.quiz_type_id.toString() === selectedTypeId)?.type_name ||
    "MCQ";

  const resolvedCatId =
    selectedCatId ||
    editingQuiz?.cat_id?.toString() ||
    (categories[0]?.cat_id ? String(categories[0].cat_id) : "1");
  const resolvedSecId =
    selectedSecId ||
    editingQuiz?.sec_id?.toString() ||
    (sections[0]?.sec_id ? String(sections[0].sec_id) : "1");
  const resolvedDiffId =
    selectedDiffId ||
    editingQuiz?.difficulty_id?.toString() ||
    (difficulties[0]?.difficulty_id ? String(difficulties[0].difficulty_id) : "1");
  const resolvedTypeId =
    selectedTypeId ||
    editingQuiz?.quiz_type_id?.toString() ||
    (types[0]?.quiz_type_id ? String(types[0].quiz_type_id) : "1");
  const resolvedUnit = selectedUnit || editingQuiz?.unit?.toString() || "1";

  const makeBase = (
    questionTextValue: string,
    payload: Record<string, unknown>,
  ): QueuedQuizEntry => ({
    cat_id: Number(resolvedCatId),
    sec_id: Number(resolvedSecId),
    unit: Number(resolvedUnit),
    difficulty_id: Number(resolvedDiffId),
    quiz_type_id: Number(resolvedTypeId),
    question_text: questionTextValue,
    quiz_payload: payload,
  });

  if (typeName === "MCQ") {
    const editingOptions = Array.isArray(editingQuiz?.quiz_payload?.options)
      ? (editingQuiz!.quiz_payload.options as unknown[]).map(String)
      : null;
    const options = [0, 1, 2, 3].map((idx) =>
      unitInputTab === "import" && editingOptions && editingOptions[idx]
        ? editingOptions[idx]
        : (mcqOptions[idx] ?? "").trim() || editingOptions?.[idx] || "",
    );
    const rawEditingCorrect = (
      editingQuiz?.quiz_payload as Record<string, unknown> | undefined
    )?.correct_index;
    const editingCorrect =
      typeof rawEditingCorrect === "number" ? rawEditingCorrect : undefined;
    const correct =
      unitInputTab === "import" && editingCorrect !== undefined
        ? editingCorrect
        : mcqCorrectIndex ?? editingCorrect ?? 0;

    const qText =
      questionText.trim() ||
      editingQuiz?.question_text ||
      "Untitled Multiple Choice Question";

    return makeBase(qText, {
      options: options.map((opt, i) => opt || `Option ${i + 1}`),
      correct_index: correct,
      ...(typeof editingQuiz?.quiz_payload?.assessment === "string"
        ? { assessment: editingQuiz.quiz_payload.assessment }
        : {}),
    });
  }

  if (typeName === "FITB") {
    const editingAnswer = String(editingQuiz?.quiz_payload?.answer ?? "");
    const answer =
      unitInputTab === "import" && editingAnswer
        ? editingAnswer
        : fitbAnswer.trim() || editingAnswer;
    return makeBase(
      questionText.trim() || editingQuiz?.question_text || "Fill in the blank",
      {
        answer: answer || "answer",
      },
    );
  }

  if (typeName === "Order") {
    const editingItems = Array.isArray(editingQuiz?.quiz_payload?.items)
      ? (editingQuiz!.quiz_payload.items as string[]).filter(Boolean)
      : [];
    let items =
      unitInputTab === "import" && editingItems.length >= 2
        ? editingItems
        : orderItems.map((item) => item.trim()).filter(Boolean);
    if (items.length < 2 && editingItems.length >= 2) {
      items = editingItems;
    }
    return makeBase(
      questionText.trim() || editingQuiz?.question_text || "Arrange the items in order",
      {
        items: items.length > 0 ? items : ["Item 1", "Item 2"],
      },
    );
  }

  if (typeName === "Pair") {
    const editingPairs = Array.isArray(editingQuiz?.quiz_payload?.pairs)
      ? (editingQuiz!.quiz_payload.pairs as { left: string; right: string }[]).filter(
          (p) => p.left && p.right,
        )
      : [];
    let pairs =
      unitInputTab === "import" && editingPairs.length >= 2
        ? editingPairs
        : pairValues
            .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
            .filter((p) => p.left && p.right);
    if (pairs.length === 0 && editingPairs.length > 0) {
      pairs = editingPairs;
    }
    return makeBase(
      questionText.trim() || editingQuiz?.question_text || "Match the items",
      {
        pairs: pairs.length > 0 ? pairs : [{ left: "Item 1", right: "Match 1" }],
      },
    );
  }

  if (typeName === "CP") {
    const title = String(editingQuiz?.quiz_payload?.title ?? "").trim() || "Coding Challenge";
    const steps = cpQuizSteps
      .map((step) => ({
        prompt: step.prompt.trim(),
        template: step.template.trim(),
        expected: step.expected.trim(),
      }))
      .filter((s) => s.prompt || s.template || s.expected)
      .map((s) => ({
        prompt: s.prompt || "Instruction",
        template: s.template,
        expected: s.expected,
      }));
    const existingSteps = Array.isArray(editingQuiz?.quiz_payload?.steps)
      ? (editingQuiz.quiz_payload.steps as {
          prompt: string;
          template: string;
          expected: string;
        }[])
      : [];
    const resolvedSteps =
      unitInputTab === "import" && existingSteps.length > 0
        ? existingSteps
        : steps.length > 0
          ? steps
          : existingSteps.length > 0
            ? existingSteps
            : [{ prompt: "Instruction", template: "", expected: "" }];
    return makeBase(questionText.trim() || editingQuiz?.question_text || title, {
      title,
      steps: resolvedSteps,
      prompts: resolvedSteps.map((s) => s.prompt),
      prompt: resolvedSteps[0].prompt,
      template: resolvedSteps[0].template,
      expected: resolvedSteps[0].expected,
    });
  }

  return makeBase(
    questionText.trim() || editingQuiz?.question_text || "Quiz Question",
    editingQuiz?.quiz_payload || {},
  );
}

export function buildOrderedQuizBatch(
  queuedQuizzes: QueuedQuizEntry[],
  currentEntry: QueuedQuizEntry | null,
  currentPendingQuizIndex: number,
): QueuedQuizEntry[] {
  if (!currentEntry) return queuedQuizzes;

  const quizCount = queuedQuizzes.length + 1;
  const activeQuizIndex = currentPendingQuizIndex % quizCount;
  const queueStartIndex =
    queuedQuizzes.length === 0
      ? 0
      : (queuedQuizzes.length - activeQuizIndex) % queuedQuizzes.length;
  const orderedQueuedQuizzes = [
    ...queuedQuizzes.slice(queueStartIndex),
    ...queuedQuizzes.slice(0, queueStartIndex),
  ];
  return [
    ...orderedQueuedQuizzes.slice(0, activeQuizIndex),
    currentEntry,
    ...orderedQueuedQuizzes.slice(activeQuizIndex),
  ];
}
