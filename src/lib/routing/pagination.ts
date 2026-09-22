/**
 * Pagination — Page Object Model (POM) + cursor-based, production-ready
 * Hexagonal: domain defines contract, adapters implement storage
 */

import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
export type PaginationMode = "cursor" | "offset";

export type PageRequest = {
  limit: number;
  cursor?: string;
  offset?: number;
  page?: number;
  mode: PaginationMode;
};

export type PageResponse<T> = {
  data: T[];
  total?: number;
  count: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  page: number;
  limit: number;
};

export function parsePagination(search: URLSearchParams | Record<string, string | undefined>): PageRequest {
  const raw = {
    limit: search instanceof URLSearchParams ? search.get("limit") ?? undefined : search.limit,
    cursor: search instanceof URLSearchParams ? search.get("cursor") ?? undefined : search.cursor,
    offset: search instanceof URLSearchParams ? search.get("offset") ?? undefined : search.offset,
    page: search instanceof URLSearchParams ? search.get("page") ?? undefined : search.page,
  };
  const parsed = paginationSchema.safeParse(raw);
  const limit = parsed.success ? parsed.data.limit : 20;
  const cursor = parsed.success ? parsed.data.cursor : undefined;
  const offset = parsed.success ? parsed.data.offset : undefined;
  const page = parsed.success ? parsed.data.page : 1;

  const mode: PaginationMode = cursor ? "cursor" : "offset";
  return { limit, cursor, offset, page, mode };
}

export function buildPageResponse<T>(items: T[], opts: { limit: number; page: number; total?: number; getCursor?: (item: T) => string }): PageResponse<T> {
  const { limit, page, total, getCursor } = opts;
  const hasNext = items.length === limit;
  const hasPrev = page > 1;
  const last = items[items.length - 1];
  const nextCursor = hasNext && last && getCursor ? getCursor(last) : null;

  return {
    data: items,
    total,
    count: items.length,
    hasNext,
    hasPrev,
    nextCursor,
    prevCursor: hasPrev ? `page-${page - 1}` : null,
    page,
    limit,
  };
}

export const PAGINATION_LIMITS = {
  default: 20,
  max: 100,
  discover: 30,
  chat: 50,
  matches: 20,
  notifications: 25,
} as const;

export function clampLimit(requested: number, type: keyof typeof PAGINATION_LIMITS = "default"): number {
  const max = type === "default" ? PAGINATION_LIMITS.max : PAGINATION_LIMITS[type] ?? PAGINATION_LIMITS.max;
  return Math.min(Math.max(1, requested), max);
}

// POM: Page Object for UI
export class PageObject<T> {
  constructor(private response: PageResponse<T>) {}

  get items(): T[] {
    return this.response.data;
  }
  get isEmpty(): boolean {
    return this.response.data.length === 0;
  }
  get hasNext(): boolean {
    return this.response.hasNext;
  }
  get hasPrev(): boolean {
    return this.response.hasPrev;
  }
  get nextCursor(): string | null {
    return this.response.nextCursor;
  }
  get page(): number {
    return this.response.page;
  }
  get total(): number | undefined {
    return this.response.total;
  }

  toJSON(): PageResponse<T> {
    return this.response;
  }
}
