"use client";

import React from "react";

interface QuizPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  isPending: boolean;
  onPageChange: (page: number) => void;
}

export const QuizPagination: React.FC<QuizPaginationProps> = ({
  currentPage,
  totalPages,
  totalCount,
  isPending,
  onPageChange,
}) => {
  if (totalCount <= 0) return null;

  return (
    <div className="pagination-controls" aria-label="Quiz pagination">
      <button
        type="button"
        className="pagination-button"
        onClick={() => onPageChange(currentPage - 1)}
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
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isPending || currentPage === totalPages}
      >
        Next
      </button>
    </div>
  );
};
