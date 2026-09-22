import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { numberOf, toCardItems, type CardItem } from "@/lib/list-payload";
import { SCREEN_SOURCES, type ScreenKey } from "@/lib/screen-sources";

/**
 * The read behind a generated list screen.
 *
 * Each of those screens fetched a path named after itself (`/api/agenda`,
 * `/api/circles`, `/api/who-viewed-me`) with a raw `fetch` and `credentials:
 * "include"` — no bearer token, and no route at the other end. The request fell
 * through to the document handler, which answered `200 text/html`, so `res.ok` was
 * true, `res.json()` threw, and the screen showed its error branch or an empty grid
 * depending on which template it came from.
 *
 * `#/lib/screen-sources` says which canonical route each screen reads and which key
 * that route answers its list under; `#/lib/client#api` carries the token and raises
 * the server's own sentence on a refusal; `#/lib/list-payload#toCardItems` reads a
 * row whatever the route calls its fields. One code path, twenty-three screens.
 */

export interface UseScreenDataOptions {
	search?: string;
	filter?: string;
	/** Route param, for detail screens (`/events/$eventId` and friends). */
	id?: string;
	enabled?: boolean;
}

export interface ScreenData {
	items: CardItem[];
	total: number;
	online: number;
	/** The whole payload, for a screen that needs a field the cards do not carry. */
	payload: Record<string, unknown> | null;
}

export function useScreenData(key: ScreenKey, options: UseScreenDataOptions = {}) {
	const source = SCREEN_SOURCES[key];
	const search = options.search ?? "";
	const filter = options.filter ?? "All";
	const id = options.id ?? "";
	const hasId = !source.requiresId || Boolean(id);

	return useQuery({
		queryKey: ["screen", key, search, filter, id],
		queryFn: async (): Promise<ScreenData> => {
			const payload = await api<Record<string, unknown>>(
				source.url({ search, filter, id }),
			);
			const items = toCardItems(payload, source.listKey);
			return {
				items,
				// Routes answer their count under `total` or `count`; neither is
				// guaranteed, and the number of rows on the page is the honest floor.
				total: numberOf(payload, "total", numberOf(payload, "count", items.length)),
				online: numberOf(payload, "online"),
				payload,
			};
		},
		enabled: hasId && options.enabled !== false,
		staleTime: 30_000,
		retry: 1,
	});
}
