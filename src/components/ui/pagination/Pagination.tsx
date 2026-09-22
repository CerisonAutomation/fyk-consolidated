/**
 * Pagination — Page Object Model, production-ready, accessible
 */

import { useMemo } from "react";

export type PaginationProps = {
  page: number;
  limit: number;
  total?: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  onNext?: () => void;
  onPrev?: () => void;
  siblingCount?: number;
};

export function Pagination({ page, total, hasNext, hasPrev, onPageChange, onNext, onPrev, siblingCount = 1 }: PaginationProps) {
  const totalPages = useMemo(() => {
    if (!total) return undefined;
    return Math.ceil(total / 20);
  }, [total]);

  const pages = useMemo(() => {
    if (!totalPages) return [];
    const range: (number | "...")[] = [];
    const start = Math.max(1, page - siblingCount);
    const end = Math.min(totalPages, page + siblingCount);

    if (start > 1) {
      range.push(1);
      if (start > 2) range.push("...");
    }
    for (let i = start; i <= end; i++) range.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) range.push("...");
      range.push(totalPages);
    }
    return range;
  }, [page, totalPages, siblingCount]);

  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <button
        onClick={() => (onPrev ? onPrev() : onPageChange(page - 1))}
        disabled={!hasPrev}
        className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
        aria-label="Previous page"
      >
        Previous
      </button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            aria-current={page === p ? "page" : undefined}
            className={`w-8 h-8 rounded text-sm ${page === p ? "bg-primary text-white" : "border hover:bg-muted"}`}
          >
            {p}
          </button>
        ),
      )}

      {total !== undefined && <span className="ml-2 text-xs text-muted-foreground">{total} total</span>}

      <button
        onClick={() => (onNext ? onNext() : onPageChange(page + 1))}
        disabled={!hasNext}
        className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
}

export function CursorPagination({
  hasNext,
  hasPrev,
  nextCursor,
  onNext,
  onPrev,
}: {
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor: string | null;
  onNext: (cursor: string | null) => void;
  onPrev: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-muted"
      >
        Previous
      </button>
      <button
        onClick={() => onNext(nextCursor)}
        disabled={!hasNext}
        className="px-3 py-1 bg-primary text-white rounded text-sm disabled:opacity-50 hover:bg-primary/90"
      >
        Load more
      </button>
    </div>
  );
}
