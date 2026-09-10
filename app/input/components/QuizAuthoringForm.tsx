"use client";

import React from "react";
import type {
  Category,
  Difficulty,
  QuizType,
  QuizMetricsData,
  QuizItem,
} from "@/app/actions/quiz";
import { McqEditor } from "./editors/McqEditor";
import { FitbEditor } from "./editors/FitbEditor";
import { OrderEditor } from "./editors/OrderEditor";
import { PairEditor } from "./editors/PairEditor";
import { CpEditor } from "./editors/CpEditor";

interface QuizAuthoringFormProps {
  categories: Category[];
  difficulties: Difficulty[];
  types: QuizType[];
  sections: { sec_id: number; sec_num: string }[];
  editingQuiz: QuizItem | null;
  metrics: QuizMetricsData;
  isPending: boolean;
  message: { type: "success" | "error"; text: string } | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onCancelEdit: () => void;

  selectedCatId: string;
  setSelectedCatId: (id: string) => void;
  selectedDiffId: string;
  setSelectedDiffId: (id: string) => void;
  selectedSecId: string;
  setSelectedSecId: (id: string) => void;
  selectedTypeId: string;
  setSelectedTypeId: (id: string) => void;
  questionText: string;
  setQuestionText: (text: string) => void;

  optionCount: number;
  setOptionCount: React.Dispatch<React.SetStateAction<number>>;
  cpPromptCount: number;
  onAddCPPrompt: () => void;
  onRemoveCPStep: () => void;
  handleAddOption: () => void;

  mcqOptions: string[];
  setMcqOptions: React.Dispatch<React.SetStateAction<string[]>>;
  mcqCorrectIndex: number;
  setMcqCorrectIndex: (idx: number) => void;
}

export const QuizAuthoringForm: React.FC<QuizAuthoringFormProps> = ({
  categories,
  difficulties,
  types,
  sections,
  editingQuiz,
  metrics,
  isPending,
  message,
  onSubmit,
  onCancelEdit,
  selectedCatId,
  setSelectedCatId,
  selectedDiffId,
  setSelectedDiffId,
  selectedSecId,
  setSelectedSecId,
  selectedTypeId,
  setSelectedTypeId,
  questionText,
  setQuestionText,
  optionCount,
  setOptionCount,
  cpPromptCount,
  onAddCPPrompt,
  onRemoveCPStep,
  handleAddOption,
  mcqOptions,
  setMcqOptions,
  mcqCorrectIndex,
  setMcqCorrectIndex,
}) => {
  const selectedType = types.find(
    (t) => t.quiz_type_id.toString() === selectedTypeId,
  );
  const selectedTypeName = selectedType ? selectedType.type_name : "";

  // Live telemetry calculations
  const wordCount = questionText.trim()
    ? questionText.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const charCount = questionText.length;
  const estimatedReadTimeSec = Math.max(1, Math.round(wordCount / 3.5));

  const trimmedOptions = mcqOptions.map((opt) => opt.trim());
  const filledOptions = trimmedOptions.filter(Boolean);
  const hasDuplicateOptions =
    filledOptions.length > 1 &&
    new Set(filledOptions.map((o) => o.toLowerCase())).size !==
      filledOptions.length;

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

  return (
    <div className="admin-card">
      <h2>
        {editingQuiz
          ? `Edit Quiz Question (ID: #${editingQuiz.quiz_id})`
          : "Create New Quiz Question"}
      </h2>

      {message && (
        <div className={`status-message status-${message.type}`}>
          {message.text}
        </div>
      )}

      <form key={editingQuiz?.quiz_id ?? "new"} onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="cat_id">Category</label>
          <select
            id="cat_id"
            name="cat_id"
            className="form-select"
            required
            value={selectedCatId}
            onChange={(e) => setSelectedCatId(e.target.value)}
          >
            <option value="" disabled>
              Select Category
            </option>
            {categories.map((cat) => (
              <option key={cat.cat_id} value={cat.cat_id.toString()}>
                {cat.cat_name}
              </option>
            ))}
          </select>
        </div>

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
              <option
                key={diff.difficulty_id}
                value={diff.difficulty_id.toString()}
              >
                {diff.difficulty_name}
              </option>
            ))}
          </select>
        </div>

        {/* Contextual Curriculum Gap Nudge */}
        {(() => {
          if (!selectedCatId || !selectedDiffId) return null;
          const cat = categories.find(
            (c) => c.cat_id.toString() === selectedCatId,
          );
          const diff = difficulties.find(
            (d) => d.difficulty_id.toString() === selectedDiffId,
          );
          if (!cat || !diff) return null;
          const catMatrix = metrics.matrix?.find(
            (m) => m.cat_name.toLowerCase() === cat.cat_name.toLowerCase(),
          );
          const count = catMatrix?.difficulties?.[diff.difficulty_name] ?? 0;
          return (
            <div className="curriculum-nudge-pill" role="status">
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
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>
                <strong>Curriculum Insight:</strong>{" "}
                {count === 0
                  ? "🚀 High priority! "
                  : count < 4
                    ? "💡 Low coverage: "
                    : "✓ "}
                Currently <strong>{count}</strong> {diff.difficulty_name}{" "}
                question{count === 1 ? "" : "s"} in <em>{cat.cat_name}</em>.
              </span>
            </div>
          );
        })()}

        <div className="form-group">
          <label htmlFor="sec_id">Section</label>
          <select
            id="sec_id"
            name="sec_id"
            className="form-select"
            required
            value={selectedSecId}
            onChange={(e) => setSelectedSecId(e.target.value)}
          >
            <option value="" disabled>
              Select Section
            </option>
            {sections.map((section) => (
              <option key={section.sec_id} value={section.sec_id.toString()}>
                {section.sec_num}
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
            {types.map((t) => (
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
                        : t.type_name === "CP"
                          ? "Coding Problem"
                          : t.type_name}
                )
              </option>
            ))}
          </select>
        </div>

        {/* Coding Problem Title & Steps */}
        {selectedTypeName === "CP" && (
          <CpEditor
            cpPromptCount={cpPromptCount}
            onAddStep={onAddCPPrompt}
            onRemoveStep={onRemoveCPStep}
            editingQuiz={editingQuiz}
          />
        )}

        {/* Standard Question Text Prompt for non-CP */}
        {selectedTypeName !== "CP" && (
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
                <span className="telemetry-item">
                  ~{estimatedReadTimeSec}s read
                </span>
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
                    {wordCount < 5
                      ? "Brief"
                      : wordCount > 45
                        ? "Extended"
                        : "Optimal"}
                  </span>
                )}
              </div>
            </div>
            <textarea
              id="question_text"
              name="question_text"
              className="form-textarea"
              placeholder="Enter the question text here..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              required
            />
          </div>
        )}

        {/* MCQ Options */}
        {selectedTypeName === "MCQ" && (
          <McqEditor
            options={mcqOptions}
            correctIndex={mcqCorrectIndex}
            onOptionChange={(idx, val) => {
              setMcqOptions((prev) => {
                const updated = [...prev];
                updated[idx] = val;
                return updated;
              });
            }}
            onCorrectIndexChange={(idx) => setMcqCorrectIndex(idx)}
            hasDuplicateOptions={hasDuplicateOptions}
            isCorrectAnswerNotablyLonger={isCorrectAnswerNotablyLonger}
          />
        )}

        {/* FITB Options */}
        {selectedTypeName === "FITB" && (
          <FitbEditor defaultValue={editingQuiz?.quiz_payload?.answer ?? ""} />
        )}

        {/* Order Options */}
        {selectedTypeName === "Order" && (
          <OrderEditor
            optionCount={optionCount}
            onAddOption={handleAddOption}
            defaultItems={editingQuiz?.quiz_payload?.items ?? []}
          />
        )}

        {/* Pair Options */}
        {selectedTypeName === "Pair" && (
          <PairEditor
            optionCount={optionCount}
            onAddOption={handleAddOption}
            defaultPairs={editingQuiz?.quiz_payload?.pairs ?? []}
          />
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={isPending}
          style={{ marginTop: "10px" }}
        >
          {isPending
            ? editingQuiz
              ? "Saving Quiz..."
              : "Adding Quiz..."
            : editingQuiz
              ? "Save Changes"
              : "Add Quiz Question"}
        </button>
        {editingQuiz && (
          <button
            type="button"
            className="btn-delete"
            onClick={onCancelEdit}
            disabled={isPending}
            style={{ marginTop: "10px", marginLeft: "10px" }}
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
};
