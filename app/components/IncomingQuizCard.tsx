"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  deletePendingQuiz,
  getPendingQuizzes,
} from "@/app/actions/quiz";

type PendingQuiz = {
  pending_id: number;
  question_text: string;
  pending_status: string;
  cat_name: string;
  sec_num?: string;
  difficulty_name: string;
  type_name: string;
  quiz_payload: {
    options?: string[];
    correct_index?: number;
    answer?: string;
    items?: string[];
    pairs?: { left: string; right: string }[];
    title?: string;
    steps?: { prompt: string; expected: string; template?: string }[];
  };
};

const icon = (path: ReactNode) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

function payloadSummary(quiz: PendingQuiz) {
  const payload = quiz.quiz_payload;
  if (quiz.type_name === "CP") return `${payload.steps?.length ?? 0} steps`;
  if (quiz.type_name === "MCQ") return `${payload.options?.length ?? 0} options`;
  if (quiz.type_name === "Order") return `${payload.items?.length ?? 0} items`;
  if (quiz.type_name === "Pair") return `${payload.pairs?.length ?? 0} pairs`;
  return quiz.type_name === "FITB" ? "Answer included" : "Details included";
}

function PayloadPreview({ quiz }: { quiz: PendingQuiz }) {
  const payload = quiz.quiz_payload;

  if (quiz.type_name === "MCQ" && payload.options) {
    return (
      <div>
        <strong>Options:</strong>
        {payload.options.map((option, index) => (
          <div className="quiz-payload-option" key={index}>
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
    return <div><strong>Correct Order:</strong>{payload.items.map((item, index) => <div className="quiz-payload-option" key={index}>{index + 1}. {item}</div>)}</div>;
  }
  if (quiz.type_name === "Pair" && payload.pairs) {
    return <div><strong>Matching Pairs:</strong>{payload.pairs.map((pair, index) => <div className="quiz-payload-option" key={index}><code>{pair.left}</code> &harr; <code>{pair.right}</code></div>)}</div>;
  }
  if (quiz.type_name === "CP" && payload.steps) {
    return (
      <div className="cp-payload-steps">
        {payload.steps.map((step, index) => (
          <div className="cp-payload-step" key={index}>
            <strong>Step {index + 1}</strong>
            <div><b>Instruction:</b> {step.prompt}</div>
            {step.template && <pre>{step.template}</pre>}
            <div><b>Expected Output:</b></div>
            <pre className="cp-expected-output">{step.expected}</pre>
          </div>
        ))}
      </div>
    );
  }
  return <div>{payload.title ?? "No payload details available."}</div>;
}

export default function IncomingQuizCard({ initialQuizzes }: { initialQuizzes: PendingQuiz[] }) {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("id_desc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [idFilter, setIdFilter] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    const refreshIncomingQuizzes = () => {
      void getPendingQuizzes("all").then(setQuizzes);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshIncomingQuizzes();
    };
    const refreshInterval = window.setInterval(refreshIncomingQuizzes, 5000);

    window.addEventListener("quizweb-pending-updated", refreshIncomingQuizzes);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("quizweb-pending-updated", refreshIncomingQuizzes);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const filteredQuizzes = useMemo(() => quizzes.filter((quiz) => {
    const query = search.toLowerCase().trim();
    const cleanId = idFilter.replace(/^#/, "").trim();
    return (!query || quiz.question_text.toLowerCase().includes(query) || quiz.cat_name.toLowerCase().includes(query)) &&
      (!cleanId || quiz.pending_id.toString().includes(cleanId)) &&
      (!status || quiz.pending_status === status) && (!type || quiz.type_name === type);
  }).sort((a, b) => {
    if (sortBy === "title_asc") return a.question_text.localeCompare(b.question_text);
    if (sortBy === "title_desc") return b.question_text.localeCompare(a.question_text);
    return sortBy === "id_asc" ? a.pending_id - b.pending_id : b.pending_id - a.pending_id;
  }), [idFilter, quizzes, search, sortBy, status, type]);

  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleQuizzes = filteredQuizzes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(idFilter || search || status || type);
  const clearFilters = () => { setIdFilter(""); setSearch(""); setStatus(""); setType(""); setPage(1); };
  const copyId = (pendingId: number) => {
    void navigator.clipboard?.writeText(pendingId.toString());
    setCopiedId(pendingId);
    window.setTimeout(() => setCopiedId((current) => current === pendingId ? null : current), 1500);
  };

  const editQuiz = (quiz: PendingQuiz) => {
    const pendingId = quiz.pending_id.toString();
    window.sessionStorage.setItem("quizweb-edit-pending-id", pendingId);
    window.dispatchEvent(
      new CustomEvent("quizweb-edit-pending", { detail: pendingId }),
    );
    router.push("/input");
  };

  const removeQuiz = async (quiz: PendingQuiz) => {
    if (!window.confirm(`Delete pending quiz #${quiz.pending_id}?`)) return;
    setIsPending(true);
    const result = await deletePendingQuiz(quiz.pending_id);
    if (result.error) window.alert(result.error);
    else setQuizzes(await getPendingQuizzes("all"));
    setIsPending(false);
  };

  const viewQuiz = () => {
    window.location.href = "http://localhost:3000/test";
  };

  return (
    <section className="admin-card incoming-admin-card recent-quizzes-card" onClick={(event) => {
      if ((event.target as Element).closest(".btn-preview")) viewQuiz();
    }}>
      <div className="incoming-card-header recent-card-header">
        <div>
          <h2>Pending Quizzes</h2>
          <div className="list-visibility-counter">Showing <strong>{visibleQuizzes.length}</strong> of <strong>{quizzes.length}</strong> questions ({quizzes.length ? Math.round((visibleQuizzes.length / quizzes.length) * 100) : 0}% of bank)</div>
        </div>
        <div className="list-header-actions">
          <div className="sort-wrapper"><label htmlFor="incoming-sort" className="sort-label">{icon(<><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></>)}<span>Sort:</span></label><select id="incoming-sort" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} className="sort-select"><option value="id_desc">ID: High to Low (Newest)</option><option value="id_asc">ID: Low to High (Oldest)</option><option value="title_asc">Title: A to Z</option><option value="title_desc">Title: Z to A</option></select></div>
          <button type="button" className={`filter-toggle-btn ${filterOpen || hasFilters ? "active" : ""}`} onClick={() => setFilterOpen(!filterOpen)} aria-expanded={filterOpen}>{icon(<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />)}<span>Filters</span></button>
        </div>
      </div>

      {filterOpen && <div className="filter-panel"><div className="filter-panel-header"><span className="filter-label-container">Filter &amp; Search Options</span><button type="button" className="filter-clear-btn" onClick={clearFilters}>Clear Filters</button></div><div className="filter-grid"><label className="filter-group"><span className="filter-group-title">Pending ID</span><input className="filter-input" value={idFilter} onChange={(event) => { setIdFilter(event.target.value); setPage(1); }} placeholder="e.g. 3 or #3" /></label><label className="filter-group"><span className="filter-group-title">Quiz Title</span><input className="filter-input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search quiz title..." /></label><label className="filter-group"><span className="filter-group-title">Status</span><select className="filter-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All Statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label><label className="filter-group"><span className="filter-group-title">Quiz Type</span><select className="filter-select" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">All Types</option><option value="MCQ">MCQ</option><option value="FITB">FITB</option><option value="Order">Order</option><option value="Pair">Pair</option><option value="CP">CP</option></select></label></div></div>}

      <div className="incoming-quiz-list recent-quizzes-scroll">
        {visibleQuizzes.map((quiz) => (
          <article className="incoming-quiz-item quiz-list-item" key={quiz.pending_id}>
            <div className="incoming-quiz-title-row"><h3>{quiz.question_text}</h3><div className="recent-quiz-actions"><span className="btn-preview" title="Quiz content shown below" aria-label="Quiz content shown below">{icon(<><path d="M2.062 12.348a1 1 0 0 0 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>)}</span><button type="button" className="btn-edit" onClick={() => void editQuiz(quiz)} disabled={isPending} title="Edit quiz" aria-label="Edit quiz">{icon(<><path d="M21.174 6.812a1 1 0 0 0-1.986-.212L3.5 20.5l-.5 3 3-.5L20.888 8.8a1 1 0 0 0 .286-1.988Z" /><path d="m16 5 3 3" /></>)}</button><button type="button" className="btn-delete" onClick={() => void removeQuiz(quiz)} disabled={isPending} title="Delete quiz" aria-label="Delete quiz">{icon(<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 2 2 2v2" /><path d="M10 11v6M14 11v6" /></>)}</button></div></div>
            <div className="quiz-badge-row"><div className="badge-id-container"><button type="button" className={`badge badge-id ${copiedId === quiz.pending_id ? "copied" : ""}`} onClick={() => copyId(quiz.pending_id)} title="Click to copy Pending ID" aria-label={`Copy Pending ID ${quiz.pending_id}`}>{copiedId === quiz.pending_id ? "Copied!" : `ID: #${quiz.pending_id}`}</button><button type="button" className={`badge-id-filter-btn ${idFilter.replace(/^#/, "") === quiz.pending_id.toString() ? "filtered" : ""}`} onClick={() => { setIdFilter(idFilter.replace(/^#/, "") === quiz.pending_id.toString() ? "" : quiz.pending_id.toString()); setPage(1); }} title="Filter by this Pending ID" aria-label={`Filter by Pending ID ${quiz.pending_id}`}>{icon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)}</button></div><span className={`badge pending-list-status ${quiz.pending_status}`}>{quiz.pending_status}</span><span className="badge badge-diff">{quiz.difficulty_name}</span><span className="badge badge-cat">{quiz.cat_name}</span>{quiz.sec_num && <span className="badge badge-type">Section {quiz.sec_num}</span>}<span className="badge badge-type">{quiz.type_name}</span><span className="badge badge-metric-tag">{payloadSummary(quiz)}</span></div>
            <div className="incoming-quiz-details quiz-payload-preview"><PayloadPreview quiz={quiz} /></div>
          </article>
        ))}
      </div>

      <div className="pagination-controls"><button type="button" className="pagination-button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Previous</button><span className="pagination-status">Page {currentPage} of {totalPages} ({filteredQuizzes.length} questions)</span><button type="button" className="pagination-button" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Next</button></div>
    </section>
  );
}
