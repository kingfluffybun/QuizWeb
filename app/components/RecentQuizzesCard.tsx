"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  deleteQuiz,
  getPaginatedRecentQuizzes,
  updateQuiz,
} from "@/app/actions/quiz";
import type { Category, Difficulty, QuizType } from "@/app/actions/quiz";

type Quiz = {
  quiz_id: number;
  question_text: string;
  cat_name: string;
  sec_num?: string;
  difficulty_name: string;
  type_name: string;
  quiz_payload: {
    title?: string;
    answer?: string;
    options?: string[];
    correct_index?: number;
    items?: string[];
    pairs?: { left: string; right: string }[];
    steps?: { prompt: string; template?: string; expected: string }[];
    [key: string]: unknown;
  };
};

type Props = {
  initialQuizzes: Quiz[];
  initialPage: number;
  initialTotalPages: number;
  initialTotalCount: number;
  categories: Category[];
  difficulties: Difficulty[];
  types: QuizType[];
  sections: { sec_id: number; sec_num: string }[];
};

const icon = (children: ReactNode) => (
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
    aria-hidden="true"
  >
    {children}
  </svg>
);

function QuizPayloadPreview({ quiz }: { quiz: Quiz }) {
  const payload = quiz.quiz_payload;

  if (quiz.type_name === "MCQ" && payload.options) {
    return (
      <div>
        <strong>Options:</strong>
        {payload.options.map((option, index) => (
          <div key={index} className="quiz-payload-option">
            <span>{index + 1}. {option}</span>
            {payload.correct_index === index && <span className="correct-text">(Correct)</span>}
          </div>
        ))}
      </div>
    );
  }
  if (quiz.type_name === "FITB") {
    return <div><strong>Correct Answer:</strong> <span className="correct-text">{payload.answer}</span></div>;
  }
  if (quiz.type_name === "Order" && payload.items) {
    return <div><strong>Correct Order:</strong>{payload.items.map((item, index) => <div key={index} className="quiz-payload-option">{index + 1}. {item}</div>)}</div>;
  }
  if (quiz.type_name === "Pair" && payload.pairs) {
    return <div><strong>Matching Pairs:</strong>{payload.pairs.map((pair, index) => <div key={index} className="quiz-payload-option"><code>{pair.left}</code> &harr; <code>{pair.right}</code></div>)}</div>;
  }
  if (quiz.type_name === "CP" && payload.steps) {
    return <div className="cp-payload-steps">{payload.steps.map((step, index) => <div className="cp-payload-step" key={index}><strong>Step {index + 1}</strong><div><b>Instruction:</b> {step.prompt}</div>{step.template && <pre>{step.template}</pre>}<div><b>Expected Output:</b></div><pre className="cp-expected-output">{step.expected}</pre></div>)}</div>;
  }
  return <div>{payload.title ?? "No payload details available."}</div>;
}

export default function RecentQuizzesCard({
  initialQuizzes,
  initialPage,
  initialTotalPages,
  initialTotalCount,
  categories,
  difficulties,
  types,
  sections,
}: Props) {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [isPending, setIsPending] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [id, setId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [section, setSection] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [type, setType] = useState("");
  const [sortBy, setSortBy] = useState("id_desc");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadPage = useCallback(async (nextPage: number) => {
    setIsPending(true);
    try {
      const result = await getPaginatedRecentQuizzes(nextPage, 20, {
        id,
        search,
        category,
        section,
        difficulty,
        type,
      });
      setQuizzes(result.quizzes as Quiz[]);
      setPage(result.currentPage);
      setTotalPages(result.totalPages);
      setTotalCount(result.totalCount);
    } finally {
      setIsPending(false);
    }
  }, [category, difficulty, id, search, section, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(1), 150);
    return () => window.clearTimeout(timer);
  }, [loadPage]);

  const clearFilters = () => {
    setId("");
    setSearch("");
    setCategory("");
    setSection("");
    setDifficulty("");
    setType("");
    setSortBy("id_desc");
  };

  const activeFilterCount = [id, search, category, section, difficulty, type]
    .filter(Boolean).length + (sortBy === "id_desc" ? 0 : 1);
  const hasFilters = activeFilterCount > 0;
  const visibleQuizzes = quizzes.filter((quiz) => {
    const cleanId = id.replace(/^[#\s]+/, "").trim();
    const query = search.toLowerCase().trim();
    return (
      (!cleanId || quiz.quiz_id.toString().includes(cleanId)) &&
      (!query || [quiz.question_text, quiz.cat_name, quiz.type_name, quiz.difficulty_name]
        .some((value) => value?.toLowerCase().includes(query))) &&
      (!category || quiz.cat_name.toLowerCase() === category.toLowerCase()) &&
      (!section || (quiz.sec_num ?? "") === section) &&
      (!difficulty || quiz.difficulty_name.toLowerCase() === difficulty.toLowerCase()) &&
      (!type || quiz.type_name.toLowerCase() === type.toLowerCase())
    );
  }).sort((a, b) => {
    if (sortBy === "id_asc") return a.quiz_id - b.quiz_id;
    if (sortBy === "text_asc") return a.question_text.localeCompare(b.question_text);
    if (sortBy === "text_desc") return b.question_text.localeCompare(a.question_text);
    if (sortBy === "diff_asc" || sortBy === "diff_desc") {
      const rank: Record<string, number> = { Beginner: 1, Intermediate: 2, Advanced: 3 };
      const difference = (rank[a.difficulty_name] ?? 99) - (rank[b.difficulty_name] ?? 99);
      return sortBy === "diff_desc" ? -difference : difference;
    }
    return b.quiz_id - a.quiz_id;
  });

  const copyId = (quizId: number) => {
    void navigator.clipboard?.writeText(quizId.toString());
    setCopiedId(quizId);
    window.setTimeout(() => setCopiedId((current) => current === quizId ? null : current), 1500);
  };

  const toggleIdFilter = (quizId: number) => {
    setId((current) => current === quizId.toString() ? "" : quizId.toString());
    setFilterOpen(true);
  };

  const deleteQuestion = async (quizId: number) => {
    if (!window.confirm("Are you sure you want to delete this quiz question?")) return;
    setIsPending(true);
    try {
      const result = await deleteQuiz(quizId);
      if (result.error) window.alert(result.error);
      else await loadPage(page);
    } finally {
      setIsPending(false);
    }
  };

  const editQuestion = async (quiz: Quiz) => {
    const questionText = window.prompt("Edit question text:", quiz.question_text);
    if (questionText === null || questionText.trim() === quiz.question_text) return;
    const formData = new FormData();
    formData.set("cat_id", categories.find((item) => item.cat_name === quiz.cat_name)?.cat_id.toString() ?? "");
    formData.set("difficulty_id", difficulties.find((item) => item.difficulty_name === quiz.difficulty_name)?.difficulty_id.toString() ?? "");
    formData.set("quiz_type_id", types.find((item) => item.type_name === quiz.type_name)?.quiz_type_id.toString() ?? "");
    formData.set("sec_id", sections.find((item) => item.sec_num === quiz.sec_num)?.sec_id.toString() ?? "");
    formData.set("question_text", questionText.trim());
    const payload = quiz.quiz_payload;
    if (quiz.type_name === "MCQ" && Array.isArray(payload.options)) {
      payload.options.forEach((option, index) => formData.set(`option_${index}`, String(option)));
      formData.set("correct_option_index", String(payload.correct_index ?? 0));
    } else if (quiz.type_name === "FITB") {
      formData.set("fitb_answer", String(payload.answer ?? ""));
    } else if (quiz.type_name === "Order" && Array.isArray(payload.items)) {
      payload.items.forEach((item, index) => formData.set(`order_${index}`, String(item)));
    } else if (quiz.type_name === "Pair" && Array.isArray(payload.pairs)) {
      payload.pairs.forEach((pair, index) => {
        formData.set(`pair_left_${index}`, String(pair.left ?? ""));
        formData.set(`pair_right_${index}`, String(pair.right ?? ""));
      });
    } else if (quiz.type_name === "CP") {
      formData.set("cp_title", String(payload.title ?? ""));
      const steps = Array.isArray(payload.steps) ? payload.steps : [];
      formData.set("cp_prompt_count", String(Math.max(steps.length, 1)));
      steps.forEach((step, index) => {
        formData.set(`cp_prompt_${index}`, String(step.prompt ?? ""));
        formData.set(`cp_template_${index}`, String(step.template ?? ""));
        formData.set(`cp_expected_${index}`, String(step.expected ?? ""));
      });
    }
    const result = await updateQuiz(quiz.quiz_id, formData);
    if (result.error) window.alert(result.error);
    else await loadPage(page);
  };

  return (
    <div className="admin-card recent-quizzes-card">
      <div className="recent-card-header">
        <div>
          <h2>Recently Added Quizzes</h2>
          <div className="list-visibility-counter">
            Showing <strong>{visibleQuizzes.length}</strong> of <strong>{totalCount}</strong> questions
            {totalCount > 0 && <span className="visibility-ratio">({Math.round((visibleQuizzes.length / totalCount) * 100)}% of bank)</span>}
          </div>
        </div>
        <div className="list-header-actions">
          <div className="sort-wrapper">
            <label htmlFor="pending-sort-by" className="sort-label">{icon(<><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></>)}<span>Sort:</span></label>
            <select id="pending-sort-by" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="sort-select">
              <option value="id_desc">ID: High to Low (Newest)</option>
              <option value="id_asc">ID: Low to High (Oldest)</option>
              <option value="text_asc">Question: A to Z</option>
              <option value="text_desc">Question: Z to A</option>
              <option value="diff_asc">Difficulty: Easy to Hard</option>
              <option value="diff_desc">Difficulty: Hard to Easy</option>
            </select>
          </div>
          <button type="button" onClick={() => setFilterOpen(!filterOpen)} className={`filter-toggle-btn ${filterOpen || hasFilters ? "active" : ""}`} aria-expanded={filterOpen}>
            {icon(<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />)}
            <span>Filters</span>{activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {filterOpen && (
        <div className="filter-panel">
          <div className="filter-panel-header"><span className="filter-label-container">Filter &amp; Search Options</span>{hasFilters && <button type="button" onClick={clearFilters} className="filter-clear-btn">Clear Filters</button>}</div>
          <div className="filter-grid">
            <label className="filter-group"><span className="filter-group-title">Question ID</span><input className="filter-input" value={id} onChange={(event) => setId(event.target.value)} placeholder="e.g. 42 or #42" /></label>
            <label className="filter-group"><span className="filter-group-title">Search Prompt / Text</span><input className="filter-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search question text..." /></label>
            <label className="filter-group"><span className="filter-group-title">Category</span><select className="filter-select" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All Categories</option>{categories.map((item) => <option key={item.cat_id} value={item.cat_name}>{item.cat_name}</option>)}</select></label>
            <label className="filter-group"><span className="filter-group-title">Section</span><select className="filter-select" value={section} onChange={(event) => setSection(event.target.value)}><option value="">All Sections</option>{sections.map((item) => <option key={item.sec_id} value={item.sec_num}>Section {item.sec_num}</option>)}</select></label>
            <label className="filter-group"><span className="filter-group-title">Difficulty</span><select className="filter-select" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">All Difficulties</option>{difficulties.map((item) => <option key={item.difficulty_id} value={item.difficulty_name}>{item.difficulty_name}</option>)}</select></label>
            <label className="filter-group"><span className="filter-group-title">Quiz Type</span><select className="filter-select" value={type} onChange={(event) => setType(event.target.value)}><option value="">All Types</option>{types.map((item) => <option key={item.quiz_type_id} value={item.type_name}>{item.type_name}</option>)}</select></label>
          </div>
        </div>
      )}

      {visibleQuizzes.length === 0 ? <div className="empty-state">No quiz questions found.</div> : <div className="recent-quizzes-scroll">
        {visibleQuizzes.map((quiz) => {
          const payload = quiz.quiz_payload ?? {};
          return <div key={quiz.quiz_id} className="quiz-list-item">
            <div className="recent-quiz-title-row"><div className="quiz-list-question">{quiz.type_name === "CP" && payload.title ? payload.title : quiz.question_text}</div><div className="recent-quiz-actions">
              <button type="button" className="btn-preview" onClick={() => router.push(`/test?quizId=${quiz.quiz_id}`)} title={`Preview Question (ID: #${quiz.quiz_id})`} aria-label={`Preview Question (ID: #${quiz.quiz_id})`}>{icon(<><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>)}</button>
              <button type="button" className="btn-edit" onClick={() => void editQuestion(quiz)} title={`Edit Question (ID: #${quiz.quiz_id})`} aria-label={`Edit Question (ID: #${quiz.quiz_id})`}>{icon(<><path d="M21.174 6.812a1 1 0 0 0-1.986-.212L3.5 20.5l-.5 3 3-.5L20.888 8.8a1 1 0 0 0 .286-1.988Z" /><path d="m16 5 3 3" /></>)}</button>
              <button type="button" className="btn-delete" onClick={() => void deleteQuestion(quiz.quiz_id)} disabled={isPending} title={`Delete Question (ID: #${quiz.quiz_id})`} aria-label={`Delete Question (ID: #${quiz.quiz_id})`}>{icon(<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 2 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></>)}</button>
            </div></div>
            <div className="quiz-badge-row"><div className="badge-id-container"><button type="button" className={`badge badge-id ${copiedId === quiz.quiz_id ? "copied" : ""}`} onClick={() => copyId(quiz.quiz_id)} title="Click to copy Question ID">{copiedId === quiz.quiz_id ? "Copied!" : `ID: #${quiz.quiz_id}`}</button><button type="button" className="badge-id-filter-btn" onClick={() => toggleIdFilter(quiz.quiz_id)} title="Filter by this Question ID" aria-label="Filter by this Question ID">{icon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)}</button></div><span className="badge badge-cat">{quiz.cat_name}</span>{quiz.sec_num && <span className="badge badge-type">Section {quiz.sec_num}</span>}<span className="badge badge-diff">{quiz.difficulty_name}</span><span className="badge badge-type">{quiz.type_name}</span>{quiz.type_name === "CP" && <span className="badge badge-metric-tag">{payload.steps?.length ?? 0} steps</span>}</div>
            <div className="quiz-payload-preview"><QuizPayloadPreview quiz={quiz} /></div>
          </div>;
        })}
      </div>}

      {totalCount > 0 && <div className="pagination-controls"><button type="button" className="pagination-button" onClick={() => void loadPage(page - 1)} disabled={isPending || page === 1}>Previous</button><span className="pagination-status">Page {page} of {totalPages} ({totalCount} questions)</span><button type="button" className="pagination-button" onClick={() => void loadPage(page + 1)} disabled={isPending || page === totalPages}>Next</button></div>}
    </div>
  );
}
