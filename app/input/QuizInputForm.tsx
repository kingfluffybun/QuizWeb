"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createQuiz,
  getPaginatedRecentQuizzes,
  updateQuiz,
  deleteQuiz,
} from "../actions/quiz";
import type { Category, Difficulty, QuizType } from "../actions/quiz";

interface QuizInputFormProps {
  categories: Category[];
  difficulties: Difficulty[];
  types: QuizType[];
  sections?: { sec_id: number; sec_num: string }[];
  initialRecentQuizzes: any[];
  initialPage: number;
  initialTotalPages: number;
  initialTotalCount: number;
}

export default function QuizInputForm({
  categories,
  difficulties,
  types,
  sections = [],
  initialRecentQuizzes,
  initialPage,
  initialTotalPages,
  initialTotalCount,
}: QuizInputFormProps) {
  const router = useRouter();
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [recentQuizzes, setRecentQuizzes] =
    useState<any[]>(initialRecentQuizzes);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [isPending, setIsPending] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [idFilter, setIdFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("id_desc");
  const [optionCount, setOptionCount] = useState(4);
  const [cpPromptCount, setCpPromptCount] = useState(1);
  const [copiedQuizId, setCopiedQuizId] = useState<number | null>(null);

  const handleCopyId = (quizId: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(quizId.toString()).catch(() => {});
    }
    setCopiedQuizId(quizId);
    setTimeout(() => {
      setCopiedQuizId((prev) => (prev === quizId ? null : prev));
    }, 1500);
  };

  const handleToggleIdFilter = (quizId: number) => {
    const target = quizId.toString();
    const currentClean = idFilter.replace(/^[#\s]+/, "").trim();
    if (currentClean === target) {
      setIdFilter("");
    } else {
      setIdFilter(target);
      setIsFilterOpen(true);
    }
  };

  const hasActiveFilters =
    idFilter.trim() !== "" ||
    searchFilter.trim() !== "" ||
    categoryFilter !== "" ||
    sectionFilter !== "" ||
    difficultyFilter !== "" ||
    typeFilter !== "" ||
    sortBy !== "id_desc";

  const activeFilterCount =
    (idFilter.trim() !== "" ? 1 : 0) +
    (searchFilter.trim() !== "" ? 1 : 0) +
    (categoryFilter !== "" ? 1 : 0) +
    (sectionFilter !== "" ? 1 : 0) +
    (difficultyFilter !== "" ? 1 : 0) +
    (typeFilter !== "" ? 1 : 0) +
    (sortBy !== "id_desc" ? 1 : 0);

  const handleClearFilters = () => {
    setIdFilter("");
    setSearchFilter("");
    setCategoryFilter("");
    setSectionFilter("");
    setDifficultyFilter("");
    setTypeFilter("");
    setSortBy("id_desc");
  };

  const filteredQuizzes = recentQuizzes
    .filter((quiz) => {
      if (idFilter.trim() !== "") {
        const cleanId = idFilter.replace(/^[#\s]+/, "").trim();
        if (cleanId !== "" && !quiz.quiz_id.toString().includes(cleanId)) {
          return false;
        }
      }
      if (searchFilter.trim() !== "") {
        const query = searchFilter.toLowerCase().trim();
        const matchesText = quiz.question_text?.toLowerCase().includes(query);
        const matchesCat = quiz.cat_name?.toLowerCase().includes(query);
        const matchesType = quiz.type_name?.toLowerCase().includes(query);
        const matchesDiff = quiz.difficulty_name?.toLowerCase().includes(query);
        if (!matchesText && !matchesCat && !matchesType && !matchesDiff) {
          return false;
        }
      }
      if (categoryFilter !== "" && quiz.cat_name !== categoryFilter) {
        return false;
      }
      const quizSecNum = quiz.sec_num?.toString() ?? "";
      if (sectionFilter !== "" && quizSecNum !== sectionFilter) {
        return false;
      }
      if (difficultyFilter !== "" && quiz.difficulty_name !== difficultyFilter) {
        return false;
      }
      if (typeFilter !== "" && quiz.type_name !== typeFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "id_asc":
          return a.quiz_id - b.quiz_id;
        case "id_desc":
          return b.quiz_id - a.quiz_id;
        case "text_asc":
          return (a.question_text || "").localeCompare(b.question_text || "");
        case "text_desc":
          return (b.question_text || "").localeCompare(a.question_text || "");
        case "diff_asc": {
          const rank: Record<string, number> = {
            Beginner: 1,
            Intermediate: 2,
            Advanced: 3,
          };
          return (rank[a.difficulty_name] || 99) - (rank[b.difficulty_name] || 99);
        }
        case "diff_desc": {
          const rank: Record<string, number> = {
            Beginner: 1,
            Intermediate: 2,
            Advanced: 3,
          };
          return (rank[b.difficulty_name] || 99) - (rank[a.difficulty_name] || 99);
        }
        default:
          return b.quiz_id - a.quiz_id;
      }
    });

  const selectedType = types.find(
    (t) => t.quiz_type_id.toString() === selectedTypeId,
  );
  const selectedTypeName = selectedType ? selectedType.type_name : "";

  const handleAddOption = () => {
    setOptionCount((count) => count + 1);
  };

  const handleAddCPPrompt = () => {
    setCpPromptCount((count) => count + 1);
  };

  const handleRemoveCPStep = () => {
    setCpPromptCount((count) => Math.max(1, count - 1));
  };

  const loadQuizPage = async (page: number) => {
    setIsPending(true);
    try {
      const result = await getPaginatedRecentQuizzes(page);
      setRecentQuizzes(result.quizzes);
      setCurrentPage(result.currentPage);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    if (types.length > 0 && !selectedTypeId) {
      setSelectedTypeId(types[0].quiz_type_id.toString());
    }
  }, [types, selectedTypeId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);

    try {
      const result = editingQuiz
        ? await updateQuiz(editingQuiz.quiz_id, formData)
        : await createQuiz(null, formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else if (result.success) {
        setMessage({
          type: "success",
          text: editingQuiz
            ? "Quiz successfully updated!"
            : "Quiz successfully added to database!",
        });

        // Reset inputs
        setEditingQuiz(null);
        setOptionCount(4);
        setCpPromptCount(1);

        // Refresh list
        await loadQuizPage(currentPage);
      }
    } catch (err) {
      console.error("Submission error:", err);
      setMessage({
        type: "error",
        text: "An unexpected error occurred during submission.",
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleEdit = (quiz: any) => {
    setEditingQuiz(quiz);
    setSelectedTypeId(quiz.quiz_type_id.toString());
    setOptionCount(
      quiz.type_name === "Order"
        ? Math.max(4, quiz.quiz_payload?.items?.length ?? 0)
        : quiz.type_name === "Pair"
          ? Math.max(4, quiz.quiz_payload?.pairs?.length ?? 0)
          : 4,
    );
    if (quiz.type_name === "CP") {
      const stepCount =
        quiz.quiz_payload?.steps?.length ||
        quiz.quiz_payload?.prompts?.length ||
        1;
      setCpPromptCount(Math.max(1, stepCount));
    }
    setMessage(null);
  };

  const handleCancelEdit = () => {
    setEditingQuiz(null);
    setSelectedTypeId(types[0]?.quiz_type_id.toString() ?? "");
    setOptionCount(4);
    setCpPromptCount(1);
    setMessage(null);
  };

  const handleDelete = async (quizId: number) => {
    if (!confirm("Are you sure you want to delete this quiz question?")) {
      return;
    }

    try {
      const result = await deleteQuiz(quizId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else if (result.success) {
        setMessage({
          type: "success",
          text: "Quiz successfully deleted!",
        });

        // Refresh list
        await loadQuizPage(currentPage);
      }
    } catch (err) {
      console.error("Delete error:", err);
      setMessage({
        type: "error",
        text: "An unexpected error occurred during deletion.",
      });
    }
  };

  return (
    <>
      {/* Form Section */}
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

        <form key={editingQuiz?.quiz_id ?? "new"} onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="cat_id">Category</label>
            <select
              id="cat_id"
              name="cat_id"
              className="form-select"
              required
              defaultValue={editingQuiz?.cat_id?.toString() ?? ""}
            >
              <option value="" disabled>
                Select Category
              </option>
              {categories.map((cat) => (
                <option key={cat.cat_id} value={cat.cat_id}>
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
              defaultValue={editingQuiz?.difficulty_id?.toString() ?? ""}
            >
              <option value="" disabled>
                Select Difficulty
              </option>
              {difficulties.map((diff) => (
                <option key={diff.difficulty_id} value={diff.difficulty_id}>
                  {diff.difficulty_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sec_id">Section</label>
            <select
              id="sec_id"
              name="sec_id"
              className="form-select"
              required
              defaultValue={editingQuiz?.sec_id?.toString() ?? ""}
            >
              <option value="" disabled>
                Select Section
              </option>
              {sections.map((section) => (
                <option key={section.sec_id} value={section.sec_id}>
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

          {selectedTypeName !== "CP" && (
            <div className="form-group form-group-flex">
              <label htmlFor="question_text">Question Text / Prompt</label>
              <textarea
                id="question_text"
                name="question_text"
                className="form-textarea"
                placeholder="Enter the question text here..."
                defaultValue={editingQuiz?.question_text ?? ""}
                required
              />
            </div>
          )}

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
                Problem Steps (Instruction, Initial Code Template & Expected Output)
                <button
                  type="button"
                  className="btn-add-option"
                  onClick={handleAddCPPrompt}
                  title="Add step"
                  aria-label="Add step"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus-icon lucide-plus"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                </button>
              </label>
              <input type="hidden" name="cp_prompt_count" value={cpPromptCount} />
              <div className="options-grid options-grid-scrollable" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {Array.from({ length: cpPromptCount }, (_, idx) => idx).map((idx) => (
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "700", fontSize: "1rem", color: "#1e293b" }}>Step {idx + 1}</span>
                      {cpPromptCount > 1 && (
                        <button
                          type="button"
                          className="btn-delete"
                          style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                          onClick={handleRemoveCPStep}
                          title="Remove last step"
                        >
                          Remove Step
                        </button>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "4px", display: "block" }}>
                        Instruction
                      </label>
                      <textarea
                        name={`cp_prompt_${idx}`}
                        className="form-textarea"
                        placeholder="Enter instruction..."
                        defaultValue={
                          editingQuiz?.quiz_payload?.steps?.[idx]?.prompt ??
                          editingQuiz?.quiz_payload?.prompts?.[idx] ??
                          (idx === 0 ? editingQuiz?.question_text ?? "" : "")
                        }
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "4px", display: "block" }}>
                        Initial Code Template
                      </label>
                      <textarea
                        name={`cp_template_${idx}`}
                        className="form-textarea"
                        style={{ fontFamily: "monospace" }}
                        placeholder="e.g. function test() {\n  // your code here\n}"
                        defaultValue={
                          editingQuiz?.quiz_payload?.steps?.[idx]?.template ??
                          (idx === 0 ? editingQuiz?.quiz_payload?.template ?? "" : "")
                        }
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155", marginBottom: "4px", display: "block" }}>
                        Expected Output
                      </label>
                      <textarea
                        name={`cp_expected_${idx}`}
                        className="form-textarea"
                        style={{ fontFamily: "monospace" }}
                        placeholder="e.g. return true;"
                        defaultValue={
                          editingQuiz?.quiz_payload?.steps?.[idx]?.expected ??
                          (idx === 0 ? editingQuiz?.quiz_payload?.expected ?? "" : "")
                        }
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
                      defaultChecked={
                        editingQuiz
                          ? editingQuiz.quiz_payload?.correct_index === idx
                          : idx === 0
                      }
                    />
                    <input
                      type="text"
                      name={`option_${idx}`}
                      placeholder={`Option ${idx + 1}`}
                      className="form-input"
                      defaultValue={
                        editingQuiz?.quiz_payload?.options?.[idx] ?? ""
                      }
                      required
                    />
                  </div>
                ))}
              </div>
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
                defaultValue={editingQuiz?.quiz_payload?.answer ?? ""}
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
                Items to Order (Enter in the CORRECT sequence)
                <button
                  type="button"
                  className="btn-add-option"
                  onClick={handleAddOption}
                  title="Add item"
                  aria-label="Add item"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus-icon lucide-plus"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                </button>
              </label>
              <div className="options-grid options-grid-scrollable">
                {Array.from({ length: optionCount }, (_, idx) => idx).map((idx) => (
                  <div key={idx} className="option-row">
                    <span
                      style={{
                        minWidth: "30px",
                        fontWeight: "bold",
                      }}
                    >
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      name={`order_${idx}`}
                      placeholder={`Sequence Item ${idx + 1}`}
                      className="form-input"
                      defaultValue={
                        editingQuiz?.quiz_payload?.items?.[idx] ?? ""
                      }
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
                Matching Pairs (Enter Left and matching Right values)
                <button
                  type="button"
                  className="btn-add-option"
                  onClick={handleAddOption}
                  title="Add pair"
                  aria-label="Add pair"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus-icon lucide-plus"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                </button>
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
                      defaultValue={
                        editingQuiz?.quiz_payload?.pairs?.[idx]?.left ?? ""
                      }
                      required
                    />
                    <span style={{ color: "#aaa" }}>&harr;</span>
                    <input
                      type="text"
                      name={`pair_right_${idx}`}
                      placeholder="Right Value"
                      className="form-input"
                      defaultValue={
                        editingQuiz?.quiz_payload?.pairs?.[idx]?.right ?? ""
                      }
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
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
              onClick={handleCancelEdit}
              disabled={isPending}
              style={{ marginTop: "10px", marginLeft: "10px" }}
            >
              Cancel
            </button>
          )}
        </form >
      </div >

      {/* List Section */}
      < div className="admin-card" >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "2px solid #e0e0e0",
            paddingBottom: "10px",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <h2 style={{ margin: 0, borderBottom: "none", paddingBottom: 0 }}>
            Recently Added Quizzes
          </h2>
          <div className="list-header-actions">
            <div className="sort-wrapper">
              <label
                htmlFor="sort-by-select"
                className="sort-label"
                title="Sort Quizzes"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="sort-icon"
                  aria-hidden="true"
                >
                  <path d="m3 16 4 4 4-4" />
                  <path d="M7 20V4" />
                  <path d="m21 8-4-4-4 4" />
                  <path d="M17 4v16" />
                </svg>
                <span className="sort-label-text">Sort:</span>
              </label>
              <select
                id="sort-by-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
                aria-label="Sort quizzes"
              >
                <option value="id_desc">ID: High to Low (Newest)</option>
                <option value="id_asc">ID: Low to High (Oldest)</option>
                <option value="text_asc">Question: A → Z</option>
                <option value="text_desc">Question: Z → A</option>
                <option value="diff_asc">Difficulty: Easy → Hard</option>
                <option value="diff_desc">Difficulty: Hard → Easy</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`filter-toggle-btn ${isFilterOpen || hasActiveFilters ? "active" : ""}`}
              aria-expanded={isFilterOpen}
              title="Toggle Filters"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-funnel-icon lucide-funnel"
              >
                <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
              </svg>
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="filter-badge">{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="active-filters-bar" aria-label="Active filters">
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: "600",
                color: "#666",
              }}
            >
              Active:
            </span>
            {idFilter.trim() !== "" && (
              <span className="active-filter-tag">
                ID: #{idFilter.replace(/^[#\s]+/, "")}
                <button
                  type="button"
                  className="active-filter-tag-close"
                  onClick={() => setIdFilter("")}
                  title="Remove ID filter"
                  aria-label="Remove ID filter"
                >
                  ×
                </button>
              </span>
            )}
            {searchFilter.trim() !== "" && (
              <span className="active-filter-tag">
                Search: &ldquo;{searchFilter}&rdquo;
                <button
                  type="button"
                  className="active-filter-tag-close"
                  onClick={() => setSearchFilter("")}
                  title="Remove search query"
                  aria-label="Remove search query"
                >
                  ×
                </button>
              </span>
            )}
            {categoryFilter !== "" && (
              <span className="active-filter-tag">
                Cat: {categoryFilter}
                <button
                  type="button"
                  className="active-filter-tag-close"
                  onClick={() => setCategoryFilter("")}
                  title="Remove category filter"
                  aria-label="Remove category filter"
                >
                  ×
                </button>
              </span>
            )}
            {sectionFilter !== "" && (
              <span className="active-filter-tag">
                Sec: {sectionFilter}
                <button
                  type="button"
                  className="active-filter-tag-close"
                  onClick={() => setSectionFilter("")}
                  title="Remove section filter"
                  aria-label="Remove section filter"
                >
                  ×
                </button>
              </span>
            )}
            {difficultyFilter !== "" && (
              <span className="active-filter-tag">
                Diff: {difficultyFilter}
                <button
                  type="button"
                  className="active-filter-tag-close"
                  onClick={() => setDifficultyFilter("")}
                  title="Remove difficulty filter"
                  aria-label="Remove difficulty filter"
                >
                  ×
                </button>
              </span>
            )}
            {typeFilter !== "" && (
              <span className="active-filter-tag">
                Type: {typeFilter}
                <button
                  type="button"
                  className="active-filter-tag-close"
                  onClick={() => setTypeFilter("")}
                  title="Remove type filter"
                  aria-label="Remove type filter"
                >
                  ×
                </button>
              </span>
            )}
            {sortBy !== "id_desc" && (
              <span className="active-filter-tag">
                Sort:{" "}
                {sortBy === "id_asc"
                  ? "Oldest First"
                  : sortBy === "text_asc"
                    ? "A → Z"
                    : sortBy === "text_desc"
                      ? "Z → A"
                      : sortBy === "diff_asc"
                        ? "Easy → Hard"
                        : sortBy === "diff_desc"
                          ? "Hard → Easy"
                          : sortBy}
                <button
                  type="button"
                  className="active-filter-tag-close"
                  onClick={() => setSortBy("id_desc")}
                  title="Reset to default sort"
                  aria-label="Reset to default sort"
                >
                  ×
                </button>
              </span>
            )}
            <button
              type="button"
              className="filter-clear-btn"
              onClick={handleClearFilters}
              style={{ marginLeft: "auto", fontSize: "0.78rem" }}
            >
              Clear All
            </button>
          </div>
        )}

        {/* Collapsible Filter Panel */}
        {isFilterOpen && (
          <div className="filter-panel">
            <div className="filter-panel-header">
              <span className="filter-label-container">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-funnel-icon lucide-funnel"
                >
                  <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
                </svg>
                <span>Filter & Search Options</span>
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="filter-clear-btn"
                >
                  Clear Filters
                </button>
              )}
            </div>
            <div className="filter-grid">
              {/* Question ID Filter */}
              <div className="filter-group">
                <span className="filter-group-title">Question ID</span>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={idFilter}
                    onChange={(e) => setIdFilter(e.target.value)}
                    placeholder="e.g. 42 or #42"
                    className="filter-input"
                    aria-label="Filter by Question ID"
                  />
                  {idFilter && (
                    <button
                      type="button"
                      onClick={() => setIdFilter("")}
                      style={{
                        position: "absolute",
                        right: "10px",
                        background: "none",
                        border: "none",
                        color: "#999",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "bold",
                        padding: 0,
                      }}
                      title="Clear ID filter"
                      aria-label="Clear ID filter"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Search Prompt Text Filter */}
              <div className="filter-group">
                <span className="filter-group-title">Search Prompt / Text</span>
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search question text..."
                    className="filter-input"
                    aria-label="Search by prompt text"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter("")}
                      style={{
                        position: "absolute",
                        right: "10px",
                        background: "none",
                        border: "none",
                        color: "#999",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "bold",
                        padding: 0,
                      }}
                      title="Clear search text"
                      aria-label="Clear search text"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter */}
              <div className="filter-group">
                <span className="filter-group-title">Category</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="filter-select"
                  aria-label="Filter by category"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.cat_id} value={cat.cat_name}>
                      {cat.cat_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              {sections.length > 0 && (
                <div className="filter-group">
                  <span className="filter-group-title">Section</span>
                  <select
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    className="filter-select"
                    aria-label="Filter by section"
                  >
                    <option value="">All Sections</option>
                    {sections.map((sec) => (
                      <option key={sec.sec_id} value={sec.sec_num.toString()}>
                        Section {sec.sec_num}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Difficulty Filter */}
              <div className="filter-group">
                <span className="filter-group-title">Difficulty</span>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="filter-select"
                  aria-label="Filter by difficulty"
                >
                  <option value="">All Difficulties</option>
                  {difficulties.map((diff) => (
                    <option
                      key={diff.difficulty_id}
                      value={diff.difficulty_name}
                    >
                      {diff.difficulty_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="filter-group">
                <span className="filter-group-title">Quiz Type</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="filter-select"
                  aria-label="Filter by quiz type"
                >
                  <option value="">All Types</option>
                  {types.map((t) => (
                    <option key={t.quiz_type_id} value={t.type_name}>
                      {t.type_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {recentQuizzes.length === 0 ? (
          <div className="empty-state">
            No quiz questions created yet. Use the form on the left to add one!
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="empty-state">
            <p style={{ margin: "0 0 12px 0" }}>
              No quiz questions found matching the selected filters.
            </p>
            <button
              type="button"
              className="filter-clear-btn"
              style={{
                backgroundColor: "#fee2e2",
                color: "#ef4444",
                border: "1px solid #fca5a5",
                padding: "6px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "inline-block",
              }}
              onClick={handleClearFilters}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
            <div
              style={{
                maxHeight: "1144px",
                overflowY: "auto",
                paddingRight: "10px",
              }}
            >
              {filteredQuizzes.map((quiz) => {
                const payload = quiz.quiz_payload;
                return (
                  <div key={quiz.quiz_id} className="quiz-list-item">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                      }}
                    >
                      <div
                        className="quiz-list-question"
                        style={{ marginBottom: 0 }}
                      >
                        {quiz.question_text}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexShrink: 0,
                        }}
                      >
                        <button
                          type="button"
                          className="btn-preview"
                          onClick={() =>
                            router.push(`/test?quizId=${quiz.quiz_id}`)
                          }
                          title={`Preview Question (ID: #${quiz.quiz_id})`}
                          aria-label={`Preview Question (ID: #${quiz.quiz_id})`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-eye"
                          >
                            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() => handleEdit(quiz)}
                          title={`Edit Question (ID: #${quiz.quiz_id})`}
                          aria-label={`Edit Question (ID: #${quiz.quiz_id})`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-pencil"
                          >
                            <path d="M21.174 6.812a1 1 0 0 0-1.986-.212L3.5 20.5l-.5 3 3-.5L20.888 8.8a1 1 0 0 0 .286-1.988Z" />
                            <path d="m16 5 3 3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDelete(quiz.quiz_id)}
                          title={`Delete Question (ID: #${quiz.quiz_id})`}
                          aria-label={`Delete Question (ID: #${quiz.quiz_id})`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="lucide lucide-trash-2"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" x2="10" y1="11" y2="17" />
                            <line x1="14" x2="14" y1="11" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="quiz-badge-row">
                      {(() => {
                        const cleanFilter = idFilter
                          .replace(/^[#\s]+/, "")
                          .trim();
                        const isThisIdFiltered =
                          cleanFilter !== "" &&
                          cleanFilter === quiz.quiz_id.toString();
                        return (
                          <div
                            className={`badge-id-container ${isThisIdFiltered ? "active-filter" : ""}`}
                          >
                            <button
                              type="button"
                              className={`badge badge-id ${copiedQuizId === quiz.quiz_id ? "copied" : ""}`}
                              onClick={() => handleCopyId(quiz.quiz_id)}
                              title="Click to copy Question ID"
                              aria-label={`Copy Question ID ${quiz.quiz_id}`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                {copiedQuizId === quiz.quiz_id ? (
                                  <polyline points="20 6 9 17 4 12" />
                                ) : (
                                  <>
                                    <rect
                                      width="14"
                                      height="14"
                                      x="8"
                                      y="8"
                                      rx="2"
                                      ry="2"
                                    />
                                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                  </>
                                )}
                              </svg>
                              <span>
                                {copiedQuizId === quiz.quiz_id
                                  ? "Copied!"
                                  : `ID: #${quiz.quiz_id}`}
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`badge-id-filter-btn ${isThisIdFiltered ? "filtered" : ""}`}
                              onClick={() => handleToggleIdFilter(quiz.quiz_id)}
                              title={
                                isThisIdFiltered
                                  ? "Clear ID filter"
                                  : "Filter by this Question ID"
                              }
                              aria-label={
                                isThisIdFiltered
                                  ? "Clear ID filter"
                                  : `Filter by Question ID ${quiz.quiz_id}`
                              }
                            >
                              {isThisIdFiltered ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="11"
                                  height="11"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <path d="M18 6 6 18" />
                                  <path d="m6 6 12 12" />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="11"
                                  height="11"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                >
                                  <circle cx="11" cy="11" r="8" />
                                  <path d="m21 21-4.3-4.3" />
                                </svg>
                              )}
                            </button>
                          </div>
                        );
                      })()}
                      <span className="badge badge-cat">{quiz.cat_name}</span>
                      {quiz.sec_num && (
                        <span className="badge badge-type">
                          Section {quiz.sec_num}
                        </span>
                      )}
                      <span className="badge badge-diff">
                        {quiz.difficulty_name}
                      </span>
                      <span className="badge badge-type">{quiz.type_name}</span>
                    </div>
                    {payload && (
                      <div className="quiz-payload-preview">
                        {/* MCQ Rendering */}
                        {quiz.type_name === "MCQ" && payload.options && (
                          <div>
                            <strong>Options:</strong>
                            {payload.options.map((opt: string, i: number) => {
                              const isCorrect = payload.correct_index === i;
                              return (
                                <div key={i} className="quiz-payload-option">
                                  <span>
                                    {i + 1}. {opt}
                                  </span>
                                  {isCorrect && (
                                    <span className="correct-text">
                                      (Correct)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* FITB Rendering */}
                        {quiz.type_name === "FITB" && (
                          <div>
                            <strong>Correct Answer:</strong>{" "}
                            <span className="correct-text">{payload.answer}</span>
                          </div>
                        )}

                        {/* Order Rendering */}
                        {quiz.type_name === "Order" && payload.items && (
                          <div>
                            <strong>Correct Order:</strong>
                            {payload.items.map((item: string, i: number) => (
                              <div
                                key={i}
                                style={{
                                  margin: "4px 0",
                                }}
                              >
                                {i + 1}. {item}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Pair Rendering */}
                        {quiz.type_name === "Pair" && payload.pairs && (
                          <div>
                            <strong>Matching Pairs:</strong>
                            {payload.pairs.map((pair: any, i: number) => (
                              <div
                                key={i}
                                style={{
                                  margin: "4px 0",
                                }}
                              >
                                <code>{pair.left}</code> &harr;{" "}
                                <code>{pair.right}</code>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* CP Rendering */}
                        {quiz.type_name === "CP" && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {payload.steps && payload.steps.length > 0 ? (
                              payload.steps.map((step: any, sIdx: number) => (
                                <div key={sIdx} style={{ backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", padding: "10px 12px", borderRadius: "8px", margin: "2px 0" }}>
                                  <div style={{ fontWeight: "700", marginBottom: "4px", color: "#1e293b" }}>Step {sIdx + 1}</div>
                                  <div><strong>Instruction:</strong> {step.prompt}</div>
                                  {step.template && (
                                    <div style={{ marginTop: "6px" }}>
                                      <strong>Initial Code Template:</strong>
                                      <pre
                                        style={{
                                          margin: "2px 0 0 0",
                                          backgroundColor: "#f1f5f9",
                                          padding: "6px",
                                          borderRadius: "4px",
                                          fontSize: "0.8rem",
                                          overflowX: "auto",
                                        }}
                                      >
                                        {step.template}
                                      </pre>
                                    </div>
                                  )}
                                  <div style={{ marginTop: "6px" }}>
                                    <strong>Expected Output:</strong>
                                    <pre
                                      style={{
                                        margin: "2px 0 0 0",
                                        backgroundColor: "#e2f0d9",
                                        padding: "6px",
                                        borderRadius: "4px",
                                        fontSize: "0.8rem",
                                        overflowX: "auto",
                                      }}
                                    >
                                      {step.expected}
                                    </pre>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div>
                                <div>
                                  <strong>Template:</strong>
                                  <pre
                                    style={{
                                      margin: "4px 0",
                                      backgroundColor: "#eee",
                                      padding: "6px",
                                      borderRadius: "4px",
                                      fontSize: "0.8rem",
                                      overflowX: "auto",
                                    }}
                                  >
                                    {payload.template}
                                  </pre>
                                </div>
                                <div>
                                  <strong>Expected Output:</strong>
                                  <pre
                                    style={{
                                      margin: "4px 0",
                                      backgroundColor: "#e2f0d9",
                                      padding: "6px",
                                      borderRadius: "4px",
                                      fontSize: "0.8rem",
                                      overflowX: "auto",
                                    }}
                                  >
                                    {payload.expected}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }

        {totalCount > 0 && (
          <div className="pagination-controls" aria-label="Quiz pagination">
            <button
              type="button"
              className="pagination-button"
              onClick={() => loadQuizPage(currentPage - 1)}
              disabled={isPending || currentPage === 1}
            >
              Previous
            </button>
            <span className="pagination-status">
              Page {currentPage} of {totalPages} ({totalCount} questions)
            </span>
            <button
              type="button"
              className="pagination-button"
              onClick={() => loadQuizPage(currentPage + 1)}
              disabled={isPending || currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div >
    </>
  );
}
