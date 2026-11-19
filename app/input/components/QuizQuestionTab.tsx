"use client";

import type { Difficulty, QuizType } from "@/app/actions/quiz";
import type {
  CPQuestionStepState,
  EditingQuizItem,
  QueuedQuizEntry,
} from "../types";

interface QuizQuestionTabProps {
  difficulties: Difficulty[];
  types: QuizType[];
  selectedDiffId: string;
  setSelectedDiffId: (val: string) => void;
  selectedTypeId: string;
  setSelectedTypeId: (val: string) => void;
  selectedTypeName: string;
  questionText: string;
  setQuestionText: (val: string) => void;
  questionTextInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsertCodeBlock: () => void;
  mcqOptions: string[];
  setMcqOptions: React.Dispatch<React.SetStateAction<string[]>>;
  mcqCorrectIndex: number;
  setMcqCorrectIndex: (idx: number) => void;
  fitbAnswer: string;
  setFitbAnswer: (val: string) => void;
  orderItems: string[];
  setOrderItems: React.Dispatch<React.SetStateAction<string[]>>;
  pairValues: { left: string; right: string }[];
  setPairValues: React.Dispatch<
    React.SetStateAction<{ left: string; right: string }[]>
  >;
  optionCount: number;
  setOptionCount: React.Dispatch<React.SetStateAction<number>>;
  cpQuizSteps: CPQuestionStepState[];
  setCpQuizSteps: React.Dispatch<React.SetStateAction<CPQuestionStepState[]>>;
  queuedQuizzes: QueuedQuizEntry[];
  currentPendingQuizIndex: number;
  editingQuiz: EditingQuizItem | null;
  preserveQuizDataOnSave: boolean;
  setPreserveQuizDataOnSave: (val: boolean) => void;
  isSubmitting: boolean;
  onAddToQueue: () => void;
  onRemoveCurrentQuiz: () => void;
  onNextQuiz: () => void;
  onPreviousQuiz: () => void;
  onSelectQuiz: (index: number) => void;
}

export default function QuizQuestionTab({
  difficulties,
  types,
  selectedDiffId,
  setSelectedDiffId,
  selectedTypeId,
  setSelectedTypeId,
  selectedTypeName,
  questionText,
  setQuestionText,
  questionTextInputRef,
  onInsertCodeBlock,
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
  editingQuiz,
  preserveQuizDataOnSave,
  setPreserveQuizDataOnSave,
  isSubmitting,
  onAddToQueue,
  onRemoveCurrentQuiz,
  onNextQuiz,
  onPreviousQuiz,
  onSelectQuiz,
}: QuizQuestionTabProps) {
  const wordCount = questionText.trim()
    ? questionText.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const charCount = questionText.length;
  const estimatedReadTimeSec = Math.max(1, Math.round(wordCount / 3.5));

  const trimmedOptions = mcqOptions.map((opt) => opt.trim());
  const filledOptions = trimmedOptions.filter(Boolean);
  const hasDuplicateOptions =
    filledOptions.length > 1 &&
    new Set(filledOptions.map((o) => o.toLowerCase())).size !== filledOptions.length;

  const correctOptionLength = trimmedOptions[mcqCorrectIndex]?.length ?? 0;
  const distractorLengths = trimmedOptions
    .filter((_, idx) => idx !== mcqCorrectIndex)
    .map((o) => o.length);
  const avgDistractorLength =
    distractorLengths.length > 0
      ? distractorLengths.reduce((a, b) => a + b, 0) / distractorLengths.length
      : 0;
  const isCorrectAnswerNotablyLonger =
    avgDistractorLength > 0 &&
    correctOptionLength > 15 &&
    correctOptionLength > avgDistractorLength * 2.2;

  const handleAddOption = () => {
    setOptionCount((count) => count + 1);
    setOrderItems((items) => [...items, ""]);
    setPairValues((pairs) => [...pairs, { left: "", right: "" }]);
  };

  const handleRemovePair = (indexToRemove: number) => {
    setOptionCount((count) => Math.max(1, count - 1));
    setPairValues((pairs) => pairs.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="unit-form-fields">
      {preserveQuizDataOnSave && (
        <div
          className="status-message status-success"
          role="status"
          style={{ marginBottom: "16px" }}
        >
          Assessment-only import is active. The unit&apos;s saved quiz data will remain unchanged.
          <button
            type="button"
            className="btn-secondary"
            style={{ marginLeft: "10px" }}
            onClick={() => setPreserveQuizDataOnSave(false)}
          >
            Enable quiz edits for this save
          </button>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="difficulty_id">Difficulty</label>
        <select
          id="difficulty_id"
          name="difficulty_id"
          className="form-select"
          required
          value={selectedDiffId}
          onChange={(e) => setSelectedDiffId(e.target.value)}
        >
          <option value="" disabled>
            Select Difficulty
          </option>
          {difficulties.map((diff) => (
            <option key={diff.difficulty_id} value={diff.difficulty_id.toString()}>
              {diff.difficulty_name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="quiz_type_id">Quiz Type</label>
        <select
          id="quiz_type_id"
          name="quiz_type_id"
          className="form-select"
          required
          value={selectedTypeId}
          onChange={(e) => {
            setSelectedTypeId(e.target.value);
            setOptionCount(4);
          }}
        >
          {types
            .filter((t) => t.type_name !== "CP" || t.type_name === selectedTypeName)
            .map((t) => (
              <option key={t.quiz_type_id} value={t.quiz_type_id}>
                {t.type_name} (
                {t.type_name === "MCQ"
                  ? "Multiple Choice"
                  : t.type_name === "FITB"
                    ? "Fill in the Blank"
                    : t.type_name === "Order"
                      ? "Syntax Arrangement"
                      : t.type_name === "Pair"
                        ? "Matching Type"
                        : t.type_name}
                )
              </option>
            ))}
        </select>
      </div>

      <div className="form-group form-group-flex">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
            flexWrap: "wrap",
            gap: "6px",
          }}
        >
          <label htmlFor="question_text" style={{ margin: 0 }}>
            Question Text / Prompt
          </label>
          <div className="input-telemetry-row" style={{ margin: 0 }}>
            <span className="telemetry-item">
              <strong>{wordCount}</strong> words
            </span>
            <span className="telemetry-separator">•</span>
            <span className="telemetry-item">
              <strong>{charCount}</strong> chars
            </span>
            <span className="telemetry-separator">•</span>
            <span className="telemetry-item">~{estimatedReadTimeSec}s read</span>
            {wordCount > 0 && (
              <span
                className={`telemetry-badge ${
                  wordCount < 5
                    ? "badge-warn"
                    : wordCount > 45
                      ? "badge-info"
                      : "badge-success"
                }`}
              >
                {wordCount < 5 ? "Brief" : wordCount > 45 ? "Extended" : "Optimal"}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="lesson-code-toggle question-code-toggle"
          onClick={onInsertCodeBlock}
          title="Wrap selected text in a code block, or insert one at the cursor"
        >
          Add code block
        </button>
        <textarea
          id="question_text"
          name="question_text"
          className="form-textarea"
          placeholder="Enter the question text here..."
          value={questionText}
          ref={questionTextInputRef}
          onChange={(e) => setQuestionText(e.target.value)}
          required
        />
      </div>

      {/* Legacy CP Question Steps (controlled so quiz navigation never remounts form) */}
      {selectedTypeName === "CP" && (
        <div className="form-group form-group-flex">
          <label
            style={{
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            Problem Steps (Instruction, Initial Code Template &amp; Expected Output)
            <button
              type="button"
              className="btn-add-option"
              onClick={() =>
                setCpQuizSteps((prev) => [
                  ...prev,
                  { prompt: "", template: "", expected: "" },
                ])
              }
              title="Add step"
              aria-label="Add step"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-plus-icon lucide-plus"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
            </button>
          </label>
          <input type="hidden" name="cp_prompt_count" value={cpQuizSteps.length} />
          <div
            className="options-grid options-grid-scrollable"
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {cpQuizSteps.map((step, idx) => (
              <div
                key={idx}
                className="option-row"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  alignItems: "stretch",
                  padding: "16px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  backgroundColor: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: "700", fontSize: "1rem", color: "#1e293b" }}>
                    Step {idx + 1}
                  </span>
                  {cpQuizSteps.length > 1 && (
                    <button
                      type="button"
                      className="btn-delete"
                      style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                      onClick={() =>
                        setCpQuizSteps((prev) =>
                          prev.length > 1 ? prev.filter((_, sIdx) => sIdx !== idx) : prev,
                        )
                      }
                      title="Remove step"
                    >
                      Remove Step
                    </button>
                  )}
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      color: "#334155",
                      marginBottom: "4px",
                      display: "block",
                    }}
                  >
                    Instruction
                  </label>
                  <textarea
                    name={`cp_prompt_${idx}`}
                    className="form-textarea"
                    placeholder="Enter instruction..."
                    value={step.prompt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCpQuizSteps((prev) =>
                        prev.map((item, sIdx) =>
                          sIdx === idx ? { ...item, prompt: val } : item,
                        ),
                      );
                    }}
                    required
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      color: "#334155",
                      marginBottom: "4px",
                      display: "block",
                    }}
                  >
                    Initial Code Template
                  </label>
                  <textarea
                    name={`cp_template_${idx}`}
                    className="form-textarea"
                    style={{ fontFamily: "monospace" }}
                    placeholder={"e.g. function test() {\n  // your code here\n}"}
                    value={step.template}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCpQuizSteps((prev) =>
                        prev.map((item, sIdx) =>
                          sIdx === idx ? { ...item, template: val } : item,
                        ),
                      );
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "600",
                      color: "#334155",
                      marginBottom: "4px",
                      display: "block",
                    }}
                  >
                    Expected Output
                  </label>
                  <textarea
                    name={`cp_expected_${idx}`}
                    className="form-textarea"
                    style={{ fontFamily: "monospace" }}
                    placeholder="e.g. return true;"
                    value={step.expected}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCpQuizSteps((prev) =>
                        prev.map((item, sIdx) =>
                          sIdx === idx ? { ...item, expected: val } : item,
                        ),
                      );
                    }}
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MCQ Options */}
      {selectedTypeName === "MCQ" && (
        <div className="form-group">
          <label style={{ marginBottom: "12px" }}>
            Answer Options (Select correct answer radio)
          </label>
          <div className="options-grid">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="option-row">
                <input
                  type="radio"
                  name="correct_option_index"
                  value={idx}
                  id={`correct_${idx}`}
                  className="radio-check"
                  required
                  checked={mcqCorrectIndex === idx}
                  onChange={() => setMcqCorrectIndex(idx)}
                />
                <input
                  type="text"
                  name={`option_${idx}`}
                  placeholder={`Option ${idx + 1}`}
                  className="form-input"
                  value={mcqOptions[idx] ?? ""}
                  onChange={(e) => {
                    const updated = [...mcqOptions];
                    updated[idx] = e.target.value;
                    setMcqOptions(updated);
                  }}
                  required
                />
              </div>
            ))}
          </div>
          {hasDuplicateOptions && (
            <div className="form-warning-alert" role="alert">
              <span>
                Warning: Duplicate choices detected! All 4 options should be distinct.
              </span>
            </div>
          )}
          {isCorrectAnswerNotablyLonger && (
            <div className="form-tip-alert" role="status">
              <span>
                Distractor Tip: The correct answer is significantly longer than distractors. Test-takers often guess the longest option.
              </span>
            </div>
          )}
        </div>
      )}

      {/* FITB Options */}
      {selectedTypeName === "FITB" && (
        <div className="form-group">
          <label htmlFor="fitb_answer">Correct Blank Answer</label>
          <input
            type="text"
            id="fitb_answer"
            name="fitb_answer"
            placeholder="Enter the correct answer word(s)..."
            className="form-input"
            value={fitbAnswer}
            onChange={(event) => setFitbAnswer(event.target.value)}
            required
          />
        </div>
      )}

      {/* Order Options */}
      {selectedTypeName === "Order" && (
        <div className="form-group">
          <label
            style={{
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Items to Order (Enter in the CORRECT sequence)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className={`completeness-badge ${optionCount >= 4 ? "ready" : "pending"}`}>
                {optionCount >= 4 ? `✓ ${optionCount} items (Ready)` : `${optionCount}/4 items (Min 4)`}
              </span>
              <button
                type="button"
                className="btn-add-option"
                onClick={handleAddOption}
                title="Add item"
                aria-label="Add item"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-plus-icon lucide-plus"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </button>
            </div>
          </label>
          <div className="options-grid options-grid-scrollable">
            {Array.from({ length: optionCount }, (_, idx) => idx).map((idx) => (
              <div key={idx} className="option-row">
                <span style={{ minWidth: "30px", fontWeight: "bold" }}>{idx + 1}.</span>
                <input
                  type="text"
                  name={`order_${idx}`}
                  placeholder={`Sequence Item ${idx + 1}`}
                  className="form-input"
                  value={orderItems[idx] ?? ""}
                  onChange={(event) => {
                    const updated = [...orderItems];
                    updated[idx] = event.target.value;
                    setOrderItems(updated);
                  }}
                  required
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pair Options */}
      {selectedTypeName === "Pair" && (
        <div className="form-group">
          <label
            style={{
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Matching Pairs (Enter Left and matching Right values)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="btn-add-option pair-add-button"
                onClick={handleAddOption}
                title="Add pair"
                aria-label="Add pair"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-plus-icon lucide-plus"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                <span className="pair-add-tooltip" role="tooltip">
                  Add new pair
                </span>
              </button>
            </div>
          </label>
          <div className="options-grid options-grid-scrollable">
            {Array.from({ length: optionCount }, (_, idx) => idx).map((idx) => (
              <div key={idx} className="option-row" style={{ gap: "10px" }}>
                <span style={{ fontWeight: "bold" }}>{idx + 1}.</span>
                <input
                  type="text"
                  name={`pair_left_${idx}`}
                  placeholder="Left Key"
                  className="form-input"
                  value={pairValues[idx]?.left ?? ""}
                  onChange={(event) => {
                    const updated = [...pairValues];
                    updated[idx] = { ...updated[idx], left: event.target.value };
                    setPairValues(updated);
                  }}
                  required
                />
                <span style={{ color: "#aaa" }}>&harr;</span>
                <input
                  type="text"
                  name={`pair_right_${idx}`}
                  placeholder="Right Value"
                  className="form-input"
                  value={pairValues[idx]?.right ?? ""}
                  onChange={(event) => {
                    const updated = [...pairValues];
                    updated[idx] = { ...updated[idx], right: event.target.value };
                    setPairValues(updated);
                  }}
                  required
                />
                <button
                  type="button"
                  className="btn-delete pair-remove-button"
                  onClick={() => handleRemovePair(idx)}
                  title={`Remove pair ${idx + 1}`}
                  aria-label={`Remove pair ${idx + 1}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" x2="10" y1="11" y2="17" />
                    <line x1="14" x2="14" y1="11" y2="17" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unit Quiz Queue Controls */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: "12px",
          marginTop: "0",
        }}
      >
        {queuedQuizzes.length > 0 ||
        editingQuiz?._queuedUnitQuiz ||
        editingQuiz?._pendingUnit ? (
          <>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                Unit Quizzes:
              </span>
              {Array.from({ length: queuedQuizzes.length + 1 }, (_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`btn-secondary${idx === currentPendingQuizIndex ? " active" : ""}`}
                  style={{
                    padding: "4px 10px",
                    fontSize: "0.82rem",
                    borderRadius: "6px",
                    border:
                      idx === currentPendingQuizIndex
                        ? "2px solid var(--primary-color, #9966ff)"
                        : undefined,
                    fontWeight: 500,
                  }}
                  onClick={() => onSelectQuiz(idx)}
                >
                  Quiz {idx + 1}
                </button>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="authoring-action-button authoring-action-button-primary pending-quiz-nav-button"
                  onClick={onPreviousQuiz}
                  disabled={isSubmitting || queuedQuizzes.length === 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="authoring-action-button authoring-action-button-primary pending-quiz-nav-button"
                  onClick={onNextQuiz}
                  disabled={isSubmitting || queuedQuizzes.length === 0}
                >
                  Next
                </button>
                <span className="pending-quiz-counter">
                  Quiz {currentPendingQuizIndex + 1} of {queuedQuizzes.length + 1}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {queuedQuizzes.length > 0 && (
                  <button
                    type="button"
                    className="authoring-action-button authoring-action-button-danger"
                    onClick={onRemoveCurrentQuiz}
                    disabled={isSubmitting}
                  >
                    Remove Quiz
                  </button>
                )}
                <button
                  type="button"
                  className="authoring-action-button authoring-action-button-primary"
                  onClick={onAddToQueue}
                  disabled={isSubmitting}
                >
                  + Add Quiz
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              type="button"
              className="authoring-action-button authoring-action-button-primary"
              onClick={onAddToQueue}
              disabled={isSubmitting}
            >
              + Add Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
