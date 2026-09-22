/**
 * Feed paging, shared by every list endpoint that is ordered by recency.
 *
 * WHY NOT `readPagination`
 * ------------------------
 * `#/lib/api-helpers#readPagination` pages by uuid cursor, which suits a deck that
 * is re-drawn per request. A feed is ordered by `created_at`, so its cursor has to
 * be a point in time or rows inserted since the last page silently change position
 * and the client either repeats a row or skips one. Both shapes exist on purpose;
 * this is the time-shaped one.
 *
 * The cursor is opaque to the client: it is the `created_at` of the last row of the
 * previous page, echoed back. An invalid or absurd value degrades to "first page"
 * rather than 400, because a stale cursor in a background refetch is normal and
 * failing the whole feed over it is not.
 */

export type FeedPage = {
	limit: number;
	before: Date | null;
};

export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 50;

/** Far enough back that a real row can never be excluded by accident. */
const MIN_CURSOR_MS = Date.UTC(2000, 0, 1);

export function readFeedPage(url: URL): FeedPage {
	const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
	const limit = Number.isFinite(rawLimit)
		? Math.min(Math.max(rawLimit, 1), FEED_MAX_LIMIT)
		: FEED_DEFAULT_LIMIT;

	const rawBefore = (url.searchParams.get("before") ?? "").trim();
	let before: Date | null = null;
	if (rawBefore) {
		const ms = Date.parse(rawBefore);
		if (
			Number.isFinite(ms) &&
			ms > MIN_CURSOR_MS &&
			ms < Date.now() + 86_400_000
		)
			before = new Date(ms);
	}
	return { limit, before };
}

/** The cursor for the next page, or `null` when the page was not full. */
export function nextFeedCursor<T extends { createdAt: Date | null }>(
	rows: readonly T[],
	limit: number,
): string | null {
	if (rows.length < limit) return null;
	const last = rows[rows.length - 1];
	return last?.createdAt ? last.createdAt.toISOString() : null;
}
