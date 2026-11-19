"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CPStep } from "@/lib/cp-constants";
import {
  extractLessonSlides,
  parseAssessmentBulkImport,
  parseAssessmentImport,
  quizPayloadMatchesType,
  type AssessmentBulkImport,
} from "@/lib/assessment-json-import";
import {
  exportUnitToImportJson,
  reconcileCategory,
  stampUnitFields,
} from "@/lib/unit-form-sync";
import {
  deleteUnit,
  getUnitById,
  saveUnit,
  updatePendingUnitFromForm,
  type Category,
  type Difficulty,
  type QuizType,
  type RecentUnitItem,
} from "@/app/actions/quiz";
import type {
  CPQuestionStepState,
  EditingQuizItem,
  LessonSlideState,
  PreviewTab,
  QueuedQuizEntry,
  RecentQuizItem,
  SavedLessonSlide,
  SectionOption,
  StatusMessage,
  UnitInputTab,
} from "../types";
import {
  createProgressiveCPStep,
  getAssessmentCPSteps,
  getAssessmentDescription,
  getAssessmentTitle,
  getExpectedOutcome,
} from "../utils/assessmentExtractors";
import { buildOrderedQuizBatch, buildQuizEntryFromState } from "../utils/quizBatch";

const DEFAULT_PAIRS = () => [
  { left: "", right: "" },
  { left: "", right: "" },
  { left: "", right: "" },
  { left: "", right: "" },
];

const DEFAULT_CP_STEP = (): CPQuestionStepState => ({
  prompt: "",
  template: "",
  expected: "",
});

function extractCPQuizSteps(quiz?: EditingQuizItem | QueuedQuizEntry | null): CPQuestionStepState[] {
  const payload = quiz?.quiz_payload as
    | {
        steps?: Array<{ prompt?: string; template?: string; expected?: string }>;
        prompts?: string[];
        template?: string;
        expected?: string;
      }
    | undefined;

  if (Array.isArray(payload?.steps) && payload.steps.length > 0) {
    return payload.steps.map((s) => ({
      prompt: String(s.prompt ?? ""),
      template: String(s.template ?? ""),
      expected: String(s.expected ?? ""),
    }));
  }

  if (Array.isArray(payload?.prompts) && payload.prompts.length > 0) {
    return payload.prompts.map((prompt, idx) => ({
      prompt: String(prompt ?? ""),
      template: idx === 0 ? String(payload.template ?? "") : "",
      expected: idx === 0 ? String(payload.expected ?? "") : "",
    }));
  }

  return [
    {
      prompt: String(quiz?.question_text ?? ""),
      template: String(payload?.template ?? ""),
      expected: String(payload?.expected ?? ""),
    },
  ];
}

interface UseUnitAuthoringStateOptions {
  categories: Category[];
  difficulties: Difficulty[];
  types: QuizType[];
  sections: SectionOption[];
  initialEditingQuiz?: EditingQuizItem | null;
  currentPage: number;
  loadUnitPage: (page: number) => Promise<void>;
  suppressNextPendingEventRef: React.MutableRefObject<boolean>;
}

export function useUnitAuthoringState({
  categories,
  difficulties,
  types,
  sections,
  initialEditingQuiz,
  currentPage,
  loadUnitPage,
  suppressNextPendingEventRef,
}: UseUnitAuthoringStateOptions) {
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<EditingQuizItem | null>(
    initialEditingQuiz ?? null,
  );
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(false);

  const [unitInputTab, setUnitInputTab] = useState<UnitInputTab>("unit");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("lesson");

  const [unitTitle, setUnitTitle] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>(
    initialEditingQuiz?.cat_id?.toString() ||
      (categories[0]?.cat_id ? categories[0].cat_id.toString() : ""),
  );
  const [selectedDiffId, setSelectedDiffId] = useState<string>(
    initialEditingQuiz?.difficulty_id?.toString() ||
      (difficulties[0]?.difficulty_id
        ? difficulties[0].difficulty_id.toString()
        : ""),
  );
  const [selectedSecId, setSelectedSecId] = useState<string>(
    initialEditingQuiz?.sec_id?.toString() || "",
  );
  const [selectedUnit, setSelectedUnit] = useState<string>(
    (initialEditingQuiz?.unit_order ?? initialEditingQuiz?.unit)?.toString() || "",
  );
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    initialEditingQuiz?.quiz_type_id?.toString() ||
      (types[0]?.quiz_type_id ? types[0].quiz_type_id.toString() : ""),
  );

  // Lesson state
  const [lessonSlides, setLessonSlides] = useState<LessonSlideState[]>([
    { text: "" },
  ]);
  const [currentLessonSlide, setCurrentLessonSlide] = useState(0);
  const [lessonEditorView, setLessonEditorView] = useState<"code" | "result">(
    "code",
  );

  // Active quiz state
  const [questionText, setQuestionText] = useState<string>(
    initialEditingQuiz?.question_text ?? "",
  );
  const questionTextInputRef = useRef<HTMLTextAreaElement>(null);
  const pendingQuestionSelection = useRef<{
    start: number;
    end: number;
  } | null>(null);
  const [mcqOptions, setMcqOptions] = useState<string[]>(["", "", "", ""]);
  const [mcqCorrectIndex, setMcqCorrectIndex] = useState<number>(0);
  const [fitbAnswer, setFitbAnswer] = useState<string>("");
  const [orderItems, setOrderItems] = useState<string[]>(["", "", "", ""]);
  const [pairValues, setPairValues] =
    useState<{ left: string; right: string }[]>(DEFAULT_PAIRS);
  const [optionCount, setOptionCount] = useState(4);
  const [cpQuizSteps, setCpQuizSteps] = useState<CPQuestionStepState[]>([
    DEFAULT_CP_STEP(),
  ]);

  // Unit quiz queue state
  const [queuedQuizzes, setQueuedQuizzes] = useState<QueuedQuizEntry[]>([]);
  const [originalUnitQuizzes, setOriginalUnitQuizzes] = useState<
    QueuedQuizEntry[]
  >([]);
  const [currentPendingQuizIndex, setCurrentPendingQuizIndex] = useState(0);
  const [preserveQuizDataOnSave, setPreserveQuizDataOnSave] = useState(false);

  // Assessment state
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentDescription, setAssessmentDescription] = useState("");
  const [cpSteps, setCpSteps] = useState<CPStep[]>([
    createProgressiveCPStep(1),
  ]);
  const [expectedOutcome, setExpectedOutcome] = useState("");

  // Import state
  const [fullJsonImport, setFullJsonImport] =
    useState<AssessmentBulkImport | null>(null);
  const [importJsonText, setImportJsonText] = useState("");
  const [importJsonMessage, setImportJsonMessage] =
    useState<StatusMessage | null>(null);

  const messageTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const selection = pendingQuestionSelection.current;
    if (!selection) return;
    const textarea = questionTextInputRef.current;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(selection.start, selection.end);
    }
    pendingQuestionSelection.current = null;
  }, [questionText]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const selectedType = types.find(
    (t) => t.quiz_type_id.toString() === selectedTypeId,
  );
  const selectedTypeName = selectedType ? selectedType.type_name : "";

  const handleSelectSection = (nextSecId: string) => {
    setSelectedSecId(nextSecId);
    setSelectedCatId((prev) => reconcileCategory(sections, nextSecId, prev));
  };

  const applySingleQuizFields = (
    quiz: EditingQuizItem | QueuedQuizEntry,
    typeName: string,
    includeUnitMeta = true,
  ) => {
    setSelectedTypeId(quiz.quiz_type_id?.toString() ?? "");
    if (includeUnitMeta) {
      if (quiz.cat_id) setSelectedCatId(quiz.cat_id.toString());
      if (quiz.sec_id) {
        handleSelectSection(quiz.sec_id.toString());
      }
      const unitOrder =
        "unit_order" in quiz ? (quiz.unit_order ?? quiz.unit) : quiz.unit;
      if (unitOrder) setSelectedUnit(unitOrder.toString());
    }
    if (quiz.difficulty_id) setSelectedDiffId(quiz.difficulty_id.toString());
    setQuestionText(quiz.question_text ?? "");

    const payload = quiz.quiz_payload as Record<string, unknown> | undefined;
    if (typeName === "MCQ") {
      setMcqOptions(
        Array.isArray(payload?.options)
          ? (payload.options as string[])
          : ["", "", "", ""],
      );
      setMcqCorrectIndex(
        typeof payload?.correct_index === "number" ? payload.correct_index : 0,
      );
    } else {
      setMcqOptions(["", "", "", ""]);
      setMcqCorrectIndex(0);
    }

    setFitbAnswer(typeName === "FITB" ? String(payload?.answer ?? "") : "");

    const items =
      typeName === "Order" && Array.isArray(payload?.items)
        ? (payload.items as string[])
        : ["", "", "", ""];
    setOrderItems(items);

    const pairs =
      typeName === "Pair" && Array.isArray(payload?.pairs)
        ? (payload.pairs as { left: string; right: string }[])
        : DEFAULT_PAIRS();
    setPairValues(pairs);

    setOptionCount(
      typeName === "Order"
        ? Math.max(4, Array.isArray(payload?.items) ? payload.items.length : 0)
        : typeName === "Pair"
          ? Math.max(4, Array.isArray(payload?.pairs) ? payload.pairs.length : 0)
          : 4,
    );

    setCpQuizSteps(
      typeName === "CP" ? extractCPQuizSteps(quiz) : [DEFAULT_CP_STEP()],
    );
  };

  const resetFormState = (options?: { resetTabs?: boolean }) => {
    setFullJsonImport(null);
    setPreserveQuizDataOnSave(false);
    setOriginalUnitQuizzes([]);
    setQueuedQuizzes([]);
    setCurrentPendingQuizIndex(0);
    setEditingQuiz(null);
    setSelectedTypeId(types[0]?.quiz_type_id.toString() ?? "");
    setSelectedCatId(categories[0]?.cat_id?.toString() ?? "");
    setSelectedDiffId(difficulties[0]?.difficulty_id?.toString() ?? "");
    setSelectedSecId("");
    setSelectedUnit("");
    setQuestionText("");
    setUnitTitle("");
    setLessonSlides([{ text: "" }]);
    setCurrentLessonSlide(0);
    setLessonEditorView("code");
    if (options?.resetTabs) {
      setUnitInputTab("lesson");
      setPreviewTab("lesson");
    } else {
      setPreviewTab("lesson");
    }
    setMcqOptions(["", "", "", ""]);
    setMcqCorrectIndex(0);
    setFitbAnswer("");
    setOrderItems(["", "", "", ""]);
    setPairValues(DEFAULT_PAIRS());
    setCpQuizSteps([DEFAULT_CP_STEP()]);
    setAssessmentTitle("");
    setAssessmentDescription("");
    setCpSteps([createProgressiveCPStep(1)]);
    setExpectedOutcome("");
    setImportJsonText("");
    setImportJsonMessage(null);
    setOptionCount(4);
  };

  const setAssessmentFields = (
    importedAssessment: AssessmentBulkImport["unit_assessment_json"],
  ) => {
    setAssessmentTitle(importedAssessment.title);
    setAssessmentDescription(importedAssessment.description);
    setCpSteps(importedAssessment.steps);
    setExpectedOutcome(importedAssessment.expected_outcome);
  };

  const buildCurrentQuizEntry = () =>
    buildQuizEntryFromState({
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
    });

  const handleApplyImportJson = () => {
    const result = parseAssessmentImport(importJsonText);
    if (!result.success) {
      setImportJsonMessage({
        type: "error",
        text: result.errors.join(" | "),
      });
      return;
    }

    if (result.mode === "assessment-only") {
      if (!editingQuiz?._pendingUnit) {
        setImportJsonMessage({
          type: "error",
          text: "For a new unit, include both unit_assessment_json and unit_quiz_json. Assessment-only JSON is for editing an existing unit.",
        });
        return;
      }

      setFullJsonImport(null);
      setPreserveQuizDataOnSave(true);
      setAssessmentFields(result.data);
      setImportJsonMessage({
        type: "success",
        text: `Loaded ${result.data.steps.length} assessment step(s). The existing quiz questions were left unchanged.`,
      });
      return;
    }

    const existingUnit = editingQuiz?._pendingUnit ? editingQuiz : null;

    const importErrors: string[] = [];
    result.data.unit_quiz_json.forEach((quiz, index) => {
      const number = index + 1;
      const type = types.find(
        (entry) => entry.quiz_type_id === quiz.quiz_type_id,
      );
      if (!categories.some((entry) => entry.cat_id === quiz.cat_id)) {
        importErrors.push(`Question ${number}: unknown cat_id ${quiz.cat_id}.`);
      }
      if (!difficulties.some((entry) => entry.difficulty_id === quiz.difficulty_id)) {
        importErrors.push(
          `Question ${number}: unknown difficulty_id ${quiz.difficulty_id}.`,
        );
      }
      if (
        quiz.sec_id != null &&
        !sections.some((entry) => entry.sec_id === quiz.sec_id)
      ) {
        importErrors.push(`Question ${number}: unknown sec_id ${quiz.sec_id}.`);
      }
      if (!type) {
        importErrors.push(
          `Question ${number}: unknown quiz_type_id ${quiz.quiz_type_id}.`,
        );
      } else if (!quizPayloadMatchesType(type.type_name, quiz.quiz_payload)) {
        importErrors.push(
          `Question ${number}: quiz_payload does not match type ${type.type_name}.`,
        );
      }
    });

    if (importErrors.length > 0) {
      setImportJsonMessage({
        type: "error",
        text: importErrors.join(" | "),
      });
      return;
    }

    const importedTitle =
      result.data.unit_title ??
      (result.data as Record<string, unknown>).title;
    if (typeof importedTitle === "string" && importedTitle.trim()) {
      setUnitTitle(importedTitle.trim());
    }

    const incomingSecId =
      result.data.sec_id ??
      (result.data as Record<string, unknown>).section_id;
    if (
      incomingSecId != null &&
      sections.some((s) => s.sec_id === Number(incomingSecId))
    ) {
      handleSelectSection(String(incomingSecId));
    }

    const rawLessonDoc =
      result.data.unit_lesson_card_json ??
      result.data.lesson_slides ??
      (result.data as Record<string, unknown>).lesson_card ??
      (result.data as Record<string, unknown>).lessons;
    const slides = extractLessonSlides(rawLessonDoc);
    if (slides && slides.length > 0) {
      setLessonSlides(slides);
      setCurrentLessonSlide(0);
      if (!importedTitle && typeof rawLessonDoc === "object" && rawLessonDoc !== null) {
        const cardTitle =
          (rawLessonDoc as Record<string, unknown>).lesson_title ??
          (rawLessonDoc as Record<string, unknown>).title;
        if (typeof cardTitle === "string" && cardTitle.trim()) {
          setUnitTitle(cardTitle.trim());
        }
      }
    }

    const importedAssessment = result.data.unit_assessment_json;
    setAssessmentFields(importedAssessment);

    const [firstQuiz, ...remainingQuizzes] = result.data.unit_quiz_json;
    setQueuedQuizzes(
      remainingQuizzes.map(({ sec_id, ...question }) => ({
        ...question,
        ...(sec_id == null ? {} : { sec_id }),
      })),
    );
    setCurrentPendingQuizIndex(0);
    setFullJsonImport(result.data);
    setPreserveQuizDataOnSave(false);
    setOriginalUnitQuizzes([]);

    const firstQuizType = types.find(
      (type) => type.quiz_type_id === firstQuiz.quiz_type_id,
    );
    const { sec_id: firstQuizSectionId, ...firstQuizWithoutSection } = firstQuiz;

    const nextEditing: EditingQuizItem = existingUnit
      ? {
          ...firstQuizWithoutSection,
          sec_id:
            incomingSecId != null &&
            sections.some((s) => s.sec_id === Number(incomingSecId))
              ? Number(incomingSecId)
              : (firstQuizSectionId ?? existingUnit.sec_id),
          type_name: firstQuizType?.type_name ?? "",
          quiz_id: existingUnit.quiz_id,
          unit_id: existingUnit.unit_id,
          pending_id: existingUnit.pending_id,
          pending_status: existingUnit.pending_status,
          difficulty_name: existingUnit.difficulty_name,
          _pendingUnit: true,
          unit_assessment: {
            ...importedAssessment,
            cp_steps: importedAssessment.steps,
          },
        }
      : {
          ...firstQuizWithoutSection,
          ...(firstQuizSectionId == null ? {} : { sec_id: firstQuizSectionId }),
          type_name: firstQuizType?.type_name ?? "",
          _queuedUnitQuiz: true,
        };

    if (existingUnit) {
      setOriginalUnitQuizzes(
        result.data.unit_quiz_json.map(({ sec_id, ...question }) => ({
          ...question,
          ...(sec_id == null ? {} : { sec_id }),
        })),
      );
    }

    setEditingQuiz(nextEditing);
    applySingleQuizFields(
      nextEditing,
      firstQuizType?.type_name ?? "",
      incomingSecId == null,
    );

    const slideMsg =
      slides && slides.length > 0 ? `, ${slides.length} lesson slide(s),` : "";
    setImportJsonMessage({
      type: "success",
      text: existingUnit
        ? `Loaded ${result.data.unit_quiz_json.length} quiz question(s)${slideMsg} and ${importedAssessment.steps.length} assessment step(s) into Unit #${existingUnit.pending_id}. Saving will replace the unit's lesson, quizzes and assessment.`
        : `Loaded ${result.data.unit_quiz_json.length} quiz question(s)${slideMsg} and ${importedAssessment.steps.length} assessment step(s). You can review all sections or submit directly.`,
    });
  };

  const buildCurrentUnitImportJson = () => {
    const quizzes = preserveQuizDataOnSave
      ? originalUnitQuizzes
      : unitInputTab === "import" && fullJsonImport?.unit_quiz_json?.length
        ? fullJsonImport.unit_quiz_json
        : buildOrderedQuizBatch(
            queuedQuizzes,
            buildCurrentQuizEntry(),
            currentPendingQuizIndex,
          );
    return JSON.stringify(
      exportUnitToImportJson({
        unitTitle,
        secId: selectedSecId,
        catId: selectedCatId,
        lessonSlides,
        assessment: {
          title: assessmentTitle,
          description: assessmentDescription,
          steps: cpSteps,
          expectedOutcome,
        },
        quizzes,
      }),
      null,
      2,
    );
  };

  const handleExportUnitJson = async (target: "clipboard" | "editor") => {
    const json = buildCurrentUnitImportJson();
    if (target === "editor") {
      setImportJsonText(json);
      setUnitInputTab("import");
      setImportJsonMessage({
        type: "success",
        text: "Current unit exported below. Edit it and click Validate & Load to apply it to this unit.",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(json);
      setImportJsonMessage({
        type: "success",
        text: "Unit JSON copied to clipboard.",
      });
      setMessage({ type: "success", text: "Unit JSON copied to clipboard." });
    } catch {
      setImportJsonText(json);
      setUnitInputTab("import");
      setImportJsonMessage({
        type: "error",
        text: "Clipboard is unavailable. The unit JSON was placed in the editor below instead.",
      });
    }
  };

  const loadQueuedQuiz = (queuedQuiz: QueuedQuizEntry) => {
    const {
      cat_id: _c,
      sec_id: _s,
      unit: _u,
      ...quiz
    } = queuedQuiz;
    void _c;
    void _s;
    void _u;

    const typeName =
      types.find(
        (type) => type.quiz_type_id.toString() === quiz.quiz_type_id?.toString(),
      )?.type_name ?? "";

    const unitAssessmentSnapshot = {
      title: assessmentTitle,
      description: assessmentDescription,
      assessment: cpSteps
        .map((step) => step.instruction.trim())
        .filter(Boolean)
        .join("\n\n"),
      steps: cpSteps.map((s) => s.instruction),
      cp_steps: cpSteps,
      expected_outcome: expectedOutcome,
    };

    const nextEditing: EditingQuizItem = editingQuiz?._pendingUnit
      ? {
          ...quiz,
          type_name: typeName,
          pending_id: editingQuiz.pending_id,
          pending_status: editingQuiz.pending_status,
          _pendingUnit: true,
          unit_assessment: unitAssessmentSnapshot,
        }
      : {
          ...quiz,
          type_name: typeName,
          _queuedUnitQuiz: true,
          unit_assessment: unitAssessmentSnapshot,
        };

    setEditingQuiz(nextEditing);
    applySingleQuizFields(nextEditing, typeName, false);
  };

  const handleAddToUnitQueue = () => {
    const nextEntry = buildCurrentQuizEntry();
    if (!nextEntry) {
      setMessage({
        type: "error",
        text: "Please complete the current quiz before adding it to the unit.",
      });
      return;
    }

    const wasPendingUnit = editingQuiz?._pendingUnit;
    const pendingId = editingQuiz?.pending_id;
    const resolvedUnitAssessment = editingQuiz?.unit_assessment;
    const currentQuizId = editingQuiz?.quiz_id;

    setQueuedQuizzes((prev) => [...prev, nextEntry]);
    setQuestionText("");
    setMcqOptions(["", "", "", ""]);
    setMcqCorrectIndex(0);
    setFitbAnswer("");
    setOrderItems(["", "", "", ""]);
    setPairValues(DEFAULT_PAIRS());
    setCpQuizSteps([DEFAULT_CP_STEP()]);
    setOptionCount(4);
    setCurrentPendingQuizIndex(queuedQuizzes.length + 1);

    if (wasPendingUnit) {
      setEditingQuiz({
        cat_id: Number(selectedCatId || 1),
        sec_id: Number(selectedSecId || 1),
        unit: Number(selectedUnit || 1),
        difficulty_id: Number(selectedDiffId || 1),
        quiz_type_id: Number(selectedTypeId || 1),
        question_text: "",
        quiz_payload: {},
        pending_id: pendingId,
        quiz_id: currentQuizId,
        _pendingUnit: true,
        unit_assessment: resolvedUnitAssessment,
      });
    }

    const queueMessage: StatusMessage = {
      type: "success",
      text: `Quiz added to unit (${queuedQuizzes.length + 2}).`,
    };
    setMessage(queueMessage);
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => {
      setMessage((currentMessage) =>
        currentMessage?.text === queueMessage.text ? null : currentMessage,
      );
    }, 2000);
  };

  const handleRemoveCurrentQuiz = () => {
    if (queuedQuizzes.length === 0) {
      setMessage({
        type: "error",
        text: "A unit must retain at least one quiz.",
      });
      return;
    }
    const nextQuiz = queuedQuizzes[0];
    setQueuedQuizzes(queuedQuizzes.slice(1));
    setCurrentPendingQuizIndex((prev) =>
      Math.max(0, Math.min(prev, queuedQuizzes.length - 1)),
    );
    loadQueuedQuiz(nextQuiz);
    setMessage({ type: "success", text: "Quiz removed from unit." });
  };

  const handleNextPendingQuiz = () => {
    if (queuedQuizzes.length === 0) return;
    const currentEntry = buildCurrentQuizEntry();
    const nextQuiz = queuedQuizzes[0];
    setQueuedQuizzes([...queuedQuizzes.slice(1), currentEntry]);
    setCurrentPendingQuizIndex(
      (quizIndex) => (quizIndex + 1) % (queuedQuizzes.length + 1),
    );
    loadQueuedQuiz(nextQuiz);
    setMessage(null);
  };

  const handlePreviousPendingQuiz = () => {
    if (queuedQuizzes.length === 0) return;
    const currentEntry = buildCurrentQuizEntry();
    const previousQuiz = queuedQuizzes[queuedQuizzes.length - 1];
    setQueuedQuizzes([currentEntry, ...queuedQuizzes.slice(0, -1)]);
    setCurrentPendingQuizIndex(
      (quizIndex) =>
        (quizIndex - 1 + queuedQuizzes.length + 1) % (queuedQuizzes.length + 1),
    );
    loadQueuedQuiz(previousQuiz);
    setMessage(null);
  };

  const handleSelectPendingQuiz = (targetIndex: number) => {
    const quizCount = queuedQuizzes.length + 1;
    const activeIndex = currentPendingQuizIndex % quizCount;
    if (targetIndex < 0 || targetIndex >= quizCount || targetIndex === activeIndex) {
      return;
    }

    const currentEntry = buildCurrentQuizEntry();
    const orderedQuizzes = buildOrderedQuizBatch(
      queuedQuizzes,
      currentEntry,
      currentPendingQuizIndex,
    );
    const selectedQuiz = orderedQuizzes[targetIndex];
    if (!selectedQuiz) return;

    const nextQueuedQuizzes = [
      ...orderedQuizzes.slice(targetIndex + 1),
      ...orderedQuizzes.slice(0, targetIndex),
    ];

    setQueuedQuizzes(nextQueuedQuizzes);
    setCurrentPendingQuizIndex(targetIndex);
    loadQueuedQuiz(selectedQuiz);
    setMessage(null);
  };

  const handleEdit = (quiz: RecentQuizItem) => {
    setMessage(null);
    setFullJsonImport(null);
    setPreserveQuizDataOnSave(false);
    setOriginalUnitQuizzes([]);

    if (quiz.type_name === "Unit") {
      const pendingQuizzes = Array.isArray(quiz.quiz_payload?.quizzes)
        ? quiz.quiz_payload.quizzes
        : [];
      setOriginalUnitQuizzes(pendingQuizzes);
      const firstQuiz: QueuedQuizEntry = pendingQuizzes[0] ?? {
        cat_id: categories[0]?.cat_id,
        difficulty_id: difficulties[0]?.difficulty_id,
        quiz_type_id: types[0]?.quiz_type_id,
        sec_id: quiz.sec_id,
        unit: 1,
        question_text: "",
        quiz_payload: {},
      };
      const lessonDocument =
        quiz.quiz_payload?.lesson_card ??
        (typeof quiz.quiz_payload?.lesson_text === "string"
          ? { lesson_text: quiz.quiz_payload.lesson_text }
          : {});
      const savedSlides: SavedLessonSlide[] = Array.isArray(
        lessonDocument.lesson_slide,
      )
        ? lessonDocument.lesson_slide
        : Array.isArray(lessonDocument.lesson_slides)
          ? lessonDocument.lesson_slides
          : [];
      const firstQuizTypeName =
        types.find(
          (type) =>
            type.quiz_type_id.toString() === firstQuiz.quiz_type_id?.toString(),
        )?.type_name ??
        types[0]?.type_name ??
        "MCQ";

      setQueuedQuizzes(pendingQuizzes.slice(1));
      setCurrentPendingQuizIndex(0);
      setUnitTitle(quiz.question_text ?? "");
      setLessonSlides(
        savedSlides.length > 0
          ? savedSlides.map((slide: SavedLessonSlide) => ({
              text: slide.lesson_text ?? slide.text ?? "",
              ...((slide.lesson_title ?? slide.title) !== undefined
                ? { title: slide.lesson_title ?? slide.title }
                : {}),
              ...((slide.lesson_code ?? slide.code) !== undefined
                ? { code: slide.lesson_code ?? slide.code }
                : {}),
            }))
          : [
              {
                text: lessonDocument.lesson_text ?? "",
                ...(lessonDocument.lesson_title !== undefined
                  ? { title: lessonDocument.lesson_title }
                  : {}),
                ...(lessonDocument.lesson_code !== undefined
                  ? { code: lessonDocument.lesson_code }
                  : {}),
              },
            ],
      );
      setCurrentLessonSlide(0);
      setLessonEditorView("code");

      const assessmentValue = quiz.quiz_payload?.assessment ?? "";
      setCpSteps(getAssessmentCPSteps(assessmentValue));
      setAssessmentTitle(getAssessmentTitle(assessmentValue));
      setAssessmentDescription(getAssessmentDescription(assessmentValue));
      setExpectedOutcome(getExpectedOutcome(assessmentValue));

      const resolvedSecId = quiz.sec_id ?? firstQuiz.sec_id;
      const nextEditing: EditingQuizItem = {
        ...firstQuiz,
        unit_order: quiz.unit_order,
        sec_id: resolvedSecId,
        quiz_id: quiz.quiz_id,
        type_name: firstQuizTypeName,
        pending_id: quiz.pending_id ?? quiz.quiz_id,
        _pendingUnit: true,
        unit_assessment: assessmentValue,
        pending_status: quiz.pending_status ?? quiz.difficulty_name,
      };
      setEditingQuiz(nextEditing);
      applySingleQuizFields(nextEditing, firstQuizTypeName, true);

      const formEl =
        document.getElementById("quiz-form") ||
        document.getElementById("unit-form");
      formEl?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    const resolvedTypeName = quiz.type_name ?? "";
    setEditingQuiz(quiz);
    applySingleQuizFields(quiz, resolvedTypeName, true);
  };

  const handleEditUnit = async (unit: RecentUnitItem) => {
    setIsSubmitting(true);
    try {
      const fullUnit = await getUnitById(unit.unit_id);
      if (fullUnit) {
        handleEdit(fullUnit as unknown as RecentQuizItem);
      } else {
        setMessage({
          type: "error",
          text: `Failed to load Unit #${unit.unit_id} for editing.`,
        });
      }
    } catch (error) {
      console.error("Failed to load unit for editing:", error);
      setMessage({
        type: "error",
        text: "An error occurred while loading the unit.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unitId: number) => {
    if (
      !confirm(
        `Are you sure you want to delete Unit #${unitId}? All slides, quizzes, and assessments for this unit will also be deleted.`,
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await deleteUnit(unitId);
      if (result && "error" in result && result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: `Unit #${unitId} was deleted successfully.`,
        });
        if (editingQuiz?.unit_id === unitId || editingQuiz?.quiz_id === unitId) {
          resetFormState({ resetTabs: true });
        }
        await loadUnitPage(1);
      }
    } catch (err) {
      console.error("Delete unit error:", err);
      setMessage({
        type: "error",
        text: "An unexpected error occurred during unit deletion.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudioLaunch = (toolId: string) => {
    setEditingQuiz(null);
    setMessage(null);

    if (toolId === "cp") {
      setUnitInputTab("assessment");
      setPreviewTab("assessment");
      window.setTimeout(() => {
        document.getElementById("assessment-title")?.focus();
      }, 80);
      return;
    }

    setUnitInputTab(toolId === "unit" ? "unit" : "lesson");
    setPreviewTab("lesson");

    if (toolId === "unit") {
      window.setTimeout(() => {
        document.getElementById("unit_title")?.focus();
      }, 80);
      return;
    }

    const matchedType = types.find((t) => t.type_name.toLowerCase() === toolId);
    if (matchedType) {
      setSelectedTypeId(matchedType.quiz_type_id.toString());
    }
    window.setTimeout(() => {
      const questionInput = document.getElementById("question_text");
      if (questionInput) {
        questionInput.scrollIntoView({ behavior: "smooth", block: "center" });
        questionInput.focus();
      }
    }, 100);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    if (!selectedSecId) {
      setMessage({
        type: "error",
        text: "Please select a Section before adding the unit.",
      });
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("sec_id", selectedSecId);
    if (unitTitle.trim()) {
      formData.set("unit_title", unitTitle.trim());
    }
    lessonSlides.forEach((slide, index) => {
      formData.set(`lesson_text_${index}`, slide.text);
      formData.set(`lesson_title_${index}`, slide.title ?? "");
      if (slide.code !== undefined) {
        formData.set(`lesson_code_${index}`, slide.code);
      }
    });

    const unitQuizBatch = preserveQuizDataOnSave
      ? originalUnitQuizzes
      : unitInputTab === "import" && fullJsonImport?.unit_quiz_json?.length
        ? fullJsonImport.unit_quiz_json
        : stampUnitFields(
            buildOrderedQuizBatch(
              queuedQuizzes,
              buildCurrentQuizEntry(),
              currentPendingQuizIndex,
            ),
            {
              catId: selectedCatId,
              secId: selectedSecId,
              unit: selectedUnit,
            },
          );

    if (unitQuizBatch.length > 0) {
      formData.set("quiz_json", JSON.stringify(unitQuizBatch));
    }

    if (fullJsonImport) {
      const submittedImport = {
        unit_assessment_json: {
          schemaVersion: 2,
          title: assessmentTitle,
          description: assessmentDescription,
          steps: cpSteps,
          expected_outcome: expectedOutcome,
        },
        unit_quiz_json: unitQuizBatch.map((quiz) => ({
          cat_id: quiz.cat_id ?? 0,
          ...(quiz.sec_id == null ? {} : { sec_id: quiz.sec_id }),
          difficulty_id: quiz.difficulty_id ?? 0,
          quiz_type_id: Number(quiz.quiz_type_id ?? 0),
          question_text: quiz.question_text ?? "",
          quiz_payload: quiz.quiz_payload ?? {},
        })),
      };
      const validation = parseAssessmentBulkImport(
        JSON.stringify(submittedImport),
      );
      if (!validation.success) {
        setMessage({
          type: "error",
          text: `Imported quiz and assessment data is invalid: ${validation.errors.join(" | ")}`,
        });
        setIsSubmitting(false);
        return;
      }
      formData.set("assessment_bulk_import", JSON.stringify(submittedImport));
    }

    try {
      const unitResult =
        editingQuiz?._pendingUnit && typeof editingQuiz.pending_id === "number"
          ? await updatePendingUnitFromForm(editingQuiz.pending_id, formData)
          : await saveUnit(null, formData);

      if (unitResult.error) {
        setMessage({ type: "error", text: unitResult.error });
        return;
      }

      setMessage({
        type: "success",
        text:
          ("message" in unitResult ? unitResult.message : undefined) ??
          "Quiz submission sent for review successfully.",
      });

      router.refresh();
      if (typeof window !== "undefined") {
        suppressNextPendingEventRef.current = true;
        window.dispatchEvent(new Event("quizweb-pending-updated"));
      }

      resetFormState();
      await loadUnitPage(currentPage);
    } catch (err) {
      console.error("Submission error:", err);
      setMessage({
        type: "error",
        text: "An unexpected error occurred during submission.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    editingQuiz,
    message,
    setMessage,
    mobileNoticeDismissed,
    setMobileNoticeDismissed,
    unitInputTab,
    setUnitInputTab,
    previewTab,
    setPreviewTab,
    unitTitle,
    setUnitTitle,
    selectedCatId,
    setSelectedCatId,
    selectedDiffId,
    setSelectedDiffId,
    selectedSecId,
    handleSelectSection,
    selectedUnit,
    setSelectedUnit,
    selectedTypeId,
    setSelectedTypeId,
    selectedTypeName,
    lessonSlides,
    setLessonSlides,
    currentLessonSlide,
    setCurrentLessonSlide,
    lessonEditorView,
    setLessonEditorView,
    questionText,
    setQuestionText,
    questionTextInputRef,
    mcqOptions,
    setMcqOptions,
    mcqCorrectIndex,
    setMcqCorrectIndex,
    fitbAnswer,
    setFitbAnswer,
    orderItems,
    setOrderItems,
    pairValues,
    setPairValues,
    optionCount,
    setOptionCount,
    cpQuizSteps,
    setCpQuizSteps,
    queuedQuizzes,
    currentPendingQuizIndex,
    preserveQuizDataOnSave,
    setPreserveQuizDataOnSave,
    assessmentTitle,
    setAssessmentTitle,
    assessmentDescription,
    setAssessmentDescription,
    cpSteps,
    setCpSteps,
    expectedOutcome,
    setExpectedOutcome,
    fullJsonImport,
    importJsonText,
    setImportJsonText,
    importJsonMessage,
    setImportJsonMessage,
    handleSubmit,
    insertQuestionCodeBlock: () => {
      const textarea = questionTextInputRef.current;
      if (!textarea) return;

      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      const selectedText = questionText.slice(selectionStart, selectionEnd);
      const beforeText = questionText.slice(0, selectionStart);
      const afterText = questionText.slice(selectionEnd);
      const prefix = beforeText && !beforeText.endsWith("\n") ? "\n" : "";
      const suffix = afterText && !afterText.startsWith("\n") ? "\n" : "";
      const codeContentStart = selectionStart + prefix.length + 4;
      const insertedBlock = `${prefix}\`\`\`\n${selectedText}${selectedText.endsWith("\n") ? "" : "\n"}\`\`\`${suffix}`;

      pendingQuestionSelection.current = {
        start: codeContentStart,
        end: codeContentStart + selectedText.length,
      };
      setQuestionText(`${beforeText}${insertedBlock}${afterText}`);
    },
    handleEdit,
    handleEditUnit,
    handleDeleteUnit,
    handleCancelEdit: () => {
      resetFormState({ resetTabs: true });
      setMessage(null);
    },
    handleAddToUnitQueue,
    handleRemoveCurrentQuiz,
    handleNextPendingQuiz,
    handlePreviousPendingQuiz,
    handleSelectPendingQuiz,
    handleApplyImportJson,
    handleExportUnitJson,
    handleStudioLaunch,
  };
}
