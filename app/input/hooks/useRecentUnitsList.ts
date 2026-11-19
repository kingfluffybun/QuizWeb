"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPaginatedRecentUnits, type RecentUnitItem } from "@/app/actions/quiz";

interface UseRecentUnitsListOptions {
  categories: { cat_id: number; cat_name: string }[];
  sections: { sec_id: number; sec_num: string; cat_id?: number }[];
  initialRecentUnits?: RecentUnitItem[];
  initialPage: number;
  initialTotalPages: number;
  initialTotalCount: number;
  showRecentUnits: boolean;
}

export function useRecentUnitsList({
  categories,
  sections,
  initialRecentUnits,
  initialPage,
  initialTotalPages,
  initialTotalCount,
  showRecentUnits,
}: UseRecentUnitsListOptions) {
  const [recentUnits, setRecentUnits] = useState<RecentUnitItem[]>(
    initialRecentUnits ?? [],
  );
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [idFilter, setIdFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("id_desc");
  const [copiedUnitId, setCopiedUnitId] = useState<number | null>(null);

  const hasMountedFiltersRef = useRef(false);
  const copyTimerRef = useRef<number | null>(null);

  const loadUnitPage = useCallback(
    async (page: number) => {
      setIsLoadingList(true);
      try {
        const result = await getPaginatedRecentUnits(page, 20, {
          id: idFilter,
          search: searchFilter,
          category: categoryFilter,
          section: sectionFilter,
          status: statusFilter,
        });
        setRecentUnits(result.units);
        setCurrentPage(result.currentPage);
        setTotalPages(result.totalPages);
        setTotalCount(result.totalCount);
      } finally {
        setIsLoadingList(false);
      }
    },
    [idFilter, searchFilter, categoryFilter, sectionFilter, statusFilter],
  );

  // Skip initial mount (SSR already hydrated page 1) and debounce subsequent filter changes
  useEffect(() => {
    if (!showRecentUnits) return;
    if (!hasMountedFiltersRef.current) {
      hasMountedFiltersRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      void loadUnitPage(1);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [loadUnitPage, showRecentUnits]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const hasActiveFilters =
    idFilter.trim() !== "" ||
    searchFilter.trim() !== "" ||
    categoryFilter !== "" ||
    sectionFilter !== "" ||
    statusFilter !== "" ||
    sortBy !== "id_desc";

  const activeFilterCount =
    (idFilter.trim() !== "" ? 1 : 0) +
    (searchFilter.trim() !== "" ? 1 : 0) +
    (categoryFilter !== "" ? 1 : 0) +
    (sectionFilter !== "" ? 1 : 0) +
    (statusFilter !== "" ? 1 : 0) +
    (sortBy !== "id_desc" ? 1 : 0);

  const handleClearFilters = () => {
    setIdFilter("");
    setSearchFilter("");
    setCategoryFilter("");
    setSectionFilter("");
    setStatusFilter("");
    setSortBy("id_desc");
  };

  const handleCopyId = (unitId: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(unitId.toString()).catch(() => {});
    }
    setCopiedUnitId(unitId);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedUnitId((prev) => (prev === unitId ? null : prev));
    }, 1500);
  };

  const handleToggleIdFilter = (unitId: number) => {
    const target = unitId.toString();
    const currentClean = idFilter.replace(/^[#\s]+/, "").trim();
    if (currentClean === target) {
      setIdFilter("");
    } else {
      setIdFilter(target);
      setIsFilterOpen(true);
    }
  };

  const filteredUnits = useMemo(() => {
    const cleanId = idFilter.replace(/^[#\s]+/, "").trim();
    const query = searchFilter.toLowerCase().trim();

    return recentUnits
      .filter((unit) => {
        if (cleanId !== "" && !unit.unit_id.toString().includes(cleanId)) {
          return false;
        }
        if (query !== "") {
          const matchesTitle = unit.unit_title.toLowerCase().includes(query);
          const matchesAuthor = unit.author_name.toLowerCase().includes(query);
          if (!matchesTitle && !matchesAuthor) return false;
        }
        if (
          categoryFilter !== "" &&
          unit.cat_name.toLowerCase() !== categoryFilter.toLowerCase()
        ) {
          return false;
        }
        const unitSecNum = unit.sec_num?.toString() ?? "";
        if (sectionFilter !== "" && unitSecNum !== sectionFilter) {
          return false;
        }
        if (
          statusFilter !== "" &&
          unit.status.toLowerCase() !== statusFilter.toLowerCase()
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "id_asc":
            return a.unit_id - b.unit_id;
          case "id_desc":
            return b.unit_id - a.unit_id;
          case "title_asc":
            return a.unit_title.localeCompare(b.unit_title);
          case "title_desc":
            return b.unit_title.localeCompare(a.unit_title);
          case "slides_desc":
            return b.slide_count - a.slide_count;
          case "quizzes_desc":
            return b.question_count - a.question_count;
          default:
            return b.unit_id - a.unit_id;
        }
      });
  }, [
    recentUnits,
    idFilter,
    searchFilter,
    categoryFilter,
    sectionFilter,
    statusFilter,
    sortBy,
  ]);

  return {
    categories,
    sections,
    recentUnits,
    filteredUnits,
    currentPage,
    totalPages,
    totalCount,
    isLoadingList,
    isFilterOpen,
    setIsFilterOpen,
    idFilter,
    setIdFilter,
    searchFilter,
    setSearchFilter,
    categoryFilter,
    setCategoryFilter,
    sectionFilter,
    setSectionFilter,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    copiedUnitId,
    hasActiveFilters,
    activeFilterCount,
    loadUnitPage,
    handleClearFilters,
    handleCopyId,
    handleToggleIdFilter,
  };
}
