"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createQuiz,
  getPaginatedRecentQuizzes,
  updateQuiz,
  deleteQuiz,
  getQuizMetrics,
} from "../actions/quiz";
import type {
  Category,
  Difficulty,
  QuizType,
  QuizMetricsData,
  QuizItem,
} from "../actions/quiz";
import { QuizMetricsBanner } from "./components/QuizMetricsBanner";
import { QuizAuthoringForm } from "./components/QuizAuthoringForm";
import { QuizListSection } from "./components/QuizListSection";

interface QuizInputFormProps {
  categories: Category[];
  difficulties: Difficulty[];
  types: QuizType[];
  sections?: { sec_id: number; sec_num: string }[];
  initialRecentQuizzes: QuizItem[];
  initialPage: number;
  initialTotalPages: number;
  initialTotalCount: number;
  initialMetrics?: QuizMetricsData;
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
  initialMetrics,
}: QuizInputFormProps) {
  const router = useRouter();
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    () => types[0]?.quiz_type_id?.toString() ?? "",
  );
  const [recentQuizzes, setRecentQuizzes] =
    useState<QuizItem[]>(initialRecentQuizzes);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [isPending, setIsPending] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizItem | null>(null);
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

  // Metrics Suite States
  const [metrics, setMetrics] = useState<QuizMetricsData>(
    initialMetrics ?? {
      totalQuizzes: initialTotalCount,
      byCategory: [],
      byType: [],
      byDifficulty: [],
      bySection: [],
      lowCoverageSections: [],
      matrix: [],
      facetedBreakdown: [],
    },
  );
  const [isMetricsExpanded, setIsMetricsExpanded] = useState<boolean>(true);
  const [isMatrixOpen, setIsMatrixOpen] = useState<boolean>(false);

  // Authoring Input States
  const [questionText, setQuestionText] = useState<string>("");
  const [selectedCatId, setSelectedCatId] = useState<string>(
    () => categories[0]?.cat_id?.toString() ?? "",
  );
  const [selectedDiffId, setSelectedDiffId] = useState<string>(
    () => difficulties[0]?.difficulty_id?.toString() ?? "",
  );
  const [selectedSecId, setSelectedSecId] = useState<string>("");
  const [mcqOptions, setMcqOptions] = useState<string[]>(["", "", "", ""]);
  const [mcqCorrectIndex, setMcqCorrectIndex] = useState<number>(0);

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

  const filteredQuizzes = useMemo(() => {
    return recentQuizzes
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
        if (
          categoryFilter !== "" &&
          quiz.cat_name?.toLowerCase() !== categoryFilter.toLowerCase()
        ) {
          return false;
        }
        const quizSecNum = quiz.sec_num?.toString() ?? "";
        if (sectionFilter !== "" && quizSecNum !== sectionFilter) {
          return false;
        }
        if (
          difficultyFilter !== "" &&
          quiz.difficulty_name?.toLowerCase() !== difficultyFilter.toLowerCase()
        ) {
          return false;
        }
        if (
          typeFilter !== "" &&
          quiz.type_name?.toLowerCase() !== typeFilter.toLowerCase()
        ) {
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
            return (
              (rank[a.difficulty_name] || 99) - (rank[b.difficulty_name] || 99)
            );
          }
          case "diff_desc": {
            const rank: Record<string, number> = {
              Beginner: 1,
              Intermediate: 2,
              Advanced: 3,
            };
            return (
              (rank[b.difficulty_name] || 99) - (rank[a.difficulty_name] || 99)
            );
          }
          default:
            return b.quiz_id - a.quiz_id;
        }
      });
  }, [
    recentQuizzes,
    idFilter,
    searchFilter,
    categoryFilter,
    sectionFilter,
    difficultyFilter,
    typeFilter,
    sortBy,
  ]);

  const handleAddOption = () => {
    setOptionCount((count) => count + 1);
  };

  const handleAddCPPrompt = () => {
    setCpPromptCount((count) => count + 1);
  };

  const handleRemoveCPStep = () => {
    setCpPromptCount((count) => Math.max(1, count - 1));
  };

  const loadQuizPage = useCallback(
    async (page: number) => {
      setIsPending(true);
      try {
        const result = await getPaginatedRecentQuizzes(page, 20, {
          id: idFilter,
          search: searchFilter,
          category: categoryFilter,
          section: sectionFilter,
          difficulty: difficultyFilter,
          type: typeFilter,
        });
        setRecentQuizzes(result.quizzes as unknown as QuizItem[]);
        setCurrentPage(result.currentPage);
        setTotalPages(result.totalPages);
        setTotalCount(result.totalCount);
      } finally {
        setIsPending(false);
      }
    },
    [
      idFilter,
      searchFilter,
      categoryFilter,
      sectionFilter,
      difficultyFilter,
      typeFilter,
    ],
  );

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void loadQuizPage(1);
    }, 150);

    return () => window.clearTimeout(refreshTimer);
  }, [loadQuizPage]);

  const refreshMetrics = async () => {
    try {
      const freshMetrics = await getQuizMetrics();
      setMetrics(freshMetrics);
    } catch (err) {
      console.error("Failed to refresh metrics:", err);
    }
  };

  const handleQuickFilterCategory = (catName: string) => {
    setCategoryFilter((prev) =>
      prev.toLowerCase() === catName.toLowerCase() ? "" : catName,
    );
  };

  const handleQuickFilterType = (typeName: string) => {
    setTypeFilter((prev) =>
      prev.toLowerCase() === typeName.toLowerCase() ? "" : typeName,
    );
  };

  const handleQuickFilterDifficulty = (diffName: string) => {
    setDifficultyFilter((prev) =>
      prev.toLowerCase() === diffName.toLowerCase() ? "" : diffName,
    );
  };

  const handleResetFacetFilters = () => {
    setCategoryFilter("");
    setTypeFilter("");
    setDifficultyFilter("");
  };

  // Dynamic faceted metrics based on active banner clicks
  const facetedMetrics = useMemo(() => {
    const breakdown = metrics.facetedBreakdown || [];

    const activeBreakdown: {
      cat_name: string;
      difficulty_name: string;
      type_name: string;
      count: number;
    }[] =
      breakdown.length > 0
        ? breakdown
        : recentQuizzes.map((q) => ({
            cat_name: q.cat_name,
            difficulty_name: q.difficulty_name,
            type_name: q.type_name,
            count: 1,
          }));

    const catCounts: Record<string, number> = {};
    for (const cat of categories) {
      catCounts[cat.cat_name] = 0;
    }

    const typeCounts: Record<string, number> = {};
    for (const t of types) {
      typeCounts[t.type_name] = 0;
    }

    const diffCounts: Record<string, number> = {};
    for (const d of difficulties) {
      diffCounts[d.difficulty_name] = 0;
    }

    let filteredTotal = 0;

    for (const row of activeBreakdown) {
      const matchesCat =
        !categoryFilter ||
        row.cat_name.toLowerCase() === categoryFilter.toLowerCase();
      const matchesType =
        !typeFilter || row.type_name.toLowerCase() === typeFilter.toLowerCase();
      const matchesDiff =
        !difficultyFilter ||
        row.difficulty_name.toLowerCase() === difficultyFilter.toLowerCase();

      if (matchesType && matchesDiff) {
        catCounts[row.cat_name] = (catCounts[row.cat_name] || 0) + row.count;
      }
      if (matchesCat && matchesDiff) {
        typeCounts[row.type_name] =
          (typeCounts[row.type_name] || 0) + row.count;
      }
      if (matchesCat && matchesType) {
        diffCounts[row.difficulty_name] =
          (diffCounts[row.difficulty_name] || 0) + row.count;
      }
      if (matchesCat && matchesType && matchesDiff) {
        filteredTotal += row.count;
      }
    }

    const hasFacetFilter = Boolean(
      categoryFilter || typeFilter || difficultyFilter,
    );

    return {
      catCounts,
      typeCounts,
      diffCounts,
      filteredTotal: hasFacetFilter ? filteredTotal : metrics.totalQuizzes,
      hasFacetFilter,
    };
  }, [
    metrics.facetedBreakdown,
    metrics.totalQuizzes,
    recentQuizzes,
    categories,
    types,
    difficulties,
    categoryFilter,
    typeFilter,
    difficultyFilter,
  ]);

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
            : "Quiz submitted for review!",
        });

        // Reset inputs
        setEditingQuiz(null);
        setSelectedTypeId(types[0]?.quiz_type_id?.toString() ?? "");
        setSelectedCatId(categories[0]?.cat_id?.toString() ?? "");
        setSelectedDiffId(difficulties[0]?.difficulty_id?.toString() ?? "");
        setSelectedSecId("");
        setQuestionText("");
        setMcqOptions(["", "", "", ""]);
        setMcqCorrectIndex(0);
        setOptionCount(4);
        setCpPromptCount(1);

        // Refresh list and metrics
        await Promise.all([loadQuizPage(currentPage), refreshMetrics()]);
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

  const handleEdit = (quiz: QuizItem) => {
    setEditingQuiz(quiz);
    setSelectedTypeId(quiz.quiz_type_id.toString());
    setSelectedCatId(quiz.cat_id?.toString() ?? "");
    setSelectedDiffId(quiz.difficulty_id?.toString() ?? "");
    setSelectedSecId(quiz.sec_id?.toString() ?? "");
    setQuestionText(quiz.question_text || "");
    if (quiz.type_name === "MCQ") {
      setMcqOptions(
        Array.isArray(quiz.quiz_payload?.options)
          ? quiz.quiz_payload.options
          : ["", "", "", ""],
      );
      setMcqCorrectIndex(quiz.quiz_payload?.correct_index ?? 0);
    }
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
    setSelectedCatId(categories[0]?.cat_id?.toString() ?? "");
    setSelectedDiffId(difficulties[0]?.difficulty_id?.toString() ?? "");
    setSelectedSecId("");
    setQuestionText("");
    setMcqOptions(["", "", "", ""]);
    setMcqCorrectIndex(0);
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

        // Refresh list and metrics
        await Promise.all([loadQuizPage(currentPage), refreshMetrics()]);
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
      {/* Top Full-Width Metrics Banner */}
      <QuizMetricsBanner
        metrics={metrics}
        isMetricsExpanded={isMetricsExpanded}
        setIsMetricsExpanded={setIsMetricsExpanded}
        isMatrixOpen={isMatrixOpen}
        setIsMatrixOpen={setIsMatrixOpen}
        categoryFilter={categoryFilter}
        typeFilter={typeFilter}
        difficultyFilter={difficultyFilter}
        facetedMetrics={facetedMetrics}
        difficulties={difficulties}
        categories={categories}
        types={types}
        onQuickFilterCategory={handleQuickFilterCategory}
        onQuickFilterType={handleQuickFilterType}
        onQuickFilterDifficulty={handleQuickFilterDifficulty}
        onResetFacetFilters={handleResetFacetFilters}
      />

      {/* Form Section */}
      <QuizAuthoringForm
        categories={categories}
        difficulties={difficulties}
        types={types}
        sections={sections}
        editingQuiz={editingQuiz}
        metrics={metrics}
        isPending={isPending}
        message={message}
        onSubmit={handleSubmit}
        onCancelEdit={handleCancelEdit}
        selectedCatId={selectedCatId}
        setSelectedCatId={setSelectedCatId}
        selectedDiffId={selectedDiffId}
        setSelectedDiffId={setSelectedDiffId}
        selectedSecId={selectedSecId}
        setSelectedSecId={setSelectedSecId}
        selectedTypeId={selectedTypeId}
        setSelectedTypeId={setSelectedTypeId}
        questionText={questionText}
        setQuestionText={setQuestionText}
        optionCount={optionCount}
        setOptionCount={setOptionCount}
        cpPromptCount={cpPromptCount}
        onAddCPPrompt={handleAddCPPrompt}
        onRemoveCPStep={handleRemoveCPStep}
        handleAddOption={handleAddOption}
        mcqOptions={mcqOptions}
        setMcqOptions={setMcqOptions}
        mcqCorrectIndex={mcqCorrectIndex}
        setMcqCorrectIndex={setMcqCorrectIndex}
      />

      {/* List Section */}
      <QuizListSection
        categories={categories}
        difficulties={difficulties}
        types={types}
        sections={sections}
        recentQuizzes={recentQuizzes}
        filteredQuizzes={filteredQuizzes}
        totalCount={totalCount}
        metrics={metrics}
        sortBy={sortBy}
        setSortBy={setSortBy}
        isFilterOpen={isFilterOpen}
        setIsFilterOpen={setIsFilterOpen}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        idFilter={idFilter}
        setIdFilter={setIdFilter}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        sectionFilter={sectionFilter}
        setSectionFilter={setSectionFilter}
        difficultyFilter={difficultyFilter}
        setDifficultyFilter={setDifficultyFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        onClearFilters={handleClearFilters}
        copiedQuizId={copiedQuizId}
        onCopyId={handleCopyId}
        onToggleIdFilter={handleToggleIdFilter}
        onPreview={(quizId) => router.push(`/test?quizId=${quizId}`)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        currentPage={currentPage}
        totalPages={totalPages}
        isPending={isPending}
        onPageChange={loadQuizPage}
      />
    </>
  );
}
