import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

const placesResponseSchema = z.object({
	places: z.array(
		z.object({
			name: z.string(),
			address: z.string().nullable(),
			lat: z.number(),
			lon: z.number(),
			importance: z.number(),
		}),
	),
});

export type Place = z.infer<typeof placesResponseSchema>["places"][number];
export type PlacesResponse = z.infer<typeof placesResponseSchema>;

// -- Query keys --

export const placeKeys = {
	all: ["places"] as const,
	search: (query: string) => [...placeKeys.all, "search", query] as const,
};

// -- Hooks --

/**
 * Search for places by name.
 * Maps to getPlaces from open-grind.
 */
export function usePlaces(query: string | null | undefined) {
	return useQuery<PlacesResponse, ApiError>({
		queryKey: placeKeys.search(query ?? ""),
		queryFn: async () => {
			const params = new URLSearchParams({ placeName: query! });
			const res = await fetchRest(`/v3/places/search?${params.toString()}`);
			return res.jsonParsed(placesResponseSchema);
		},
		enabled: query !== null && query !== undefined && query.length > 0,
		staleTime: 5 * 60 * 1000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}
