import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --
// These are minimal schemas for the grid API responses.
// Replace with imports from @/core/model when models are available.

export const cascadeV4QuerySchema = z.object({
	nearbyGeoHash: z.string(),
	exploreGeoHash: z.string().optional(),
	pivot: z.number().optional(),
	limit: z.number().optional(),
	experience: z.string().optional(),
	sort: z.string().optional(),
});

export type CascadeV4Query = z.infer<typeof cascadeV4QuerySchema>;

export const cascadeV4ResponseSchema = z.object({
	profiles: z.array(z.record(z.string(), z.unknown())),
	more: z.boolean().optional(),
	error: z.string().optional(),
});

export type CascadeV4Response = z.infer<typeof cascadeV4ResponseSchema>;

export const searchQuerySchema = z.object({
	query: z.string().optional(),
	ageMin: z.number().optional(),
	ageMax: z.number().optional(),
	bodyType: z.array(z.number()).optional(),
	relationshipStatus: z.array(z.number()).optional(),
	tribes: z.array(z.number()).optional(),
	hivStatus: z.array(z.number()).optional(),
	sort: z.string().optional(),
	nearbyGeoHash: z.string().optional(),
	limit: z.number().optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchProfilesResponseSchema = z.object({
	profiles: z.array(z.record(z.string(), z.unknown())),
	total: z.number().optional(),
});

export type SearchProfilesResponse = z.infer<
	typeof searchProfilesResponseSchema
>;

function coarsenGeohash(geohash: string): string {
	return geohash.slice(0, Math.min(geohash.length, 4));
}

// -- Query keys --

export const gridKeys = {
	all: ["grid"] as const,
	cascade: (query: CascadeV4Query) =>
		[...gridKeys.all, "cascade", query] as const,
	search: (query: SearchQuery) =>
		[...gridKeys.all, "search", query] as const,
};

// -- Hooks --

/**
 * Fetch cascade/grid browse results (v4).
 * Maps to getCascadeV4 from open-grind.
 */
export function useCascadeV4(query: CascadeV4Query) {
	return useQuery<CascadeV4Response, ApiError>({
		queryKey: gridKeys.cascade(query),
		queryFn: async () => {
			const coarse = {
				...query,
				nearbyGeoHash: coarsenGeohash(query.nearbyGeoHash),
				...(query.exploreGeoHash && {
					exploreGeoHash: coarsenGeohash(query.exploreGeoHash),
				}),
			};
			const params = new URLSearchParams();
			for (const [key, value] of Object.entries(coarse)) {
				if (value !== undefined && value !== null) {
					params.set(key, String(value));
				}
			}
			const res = await fetchRest(`/v4/cascade?${params.toString()}`);
			return res.jsonParsed(cascadeV4ResponseSchema);
		},
		staleTime: 5 * 60 * 1000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Search profiles by filters.
 * Maps to searchProfiles from open-grind.
 */
export function useSearchProfiles(query: SearchQuery) {
	return useQuery<SearchProfilesResponse, ApiError>({
		queryKey: gridKeys.search(query),
		queryFn: async () => {
			const params = new URLSearchParams();
			for (const [key, value] of Object.entries(query)) {
				if (value !== undefined && value !== null) {
					if (Array.isArray(value)) {
						for (const item of value) {
							params.append(key, String(item));
						}
					} else {
						params.set(key, String(value));
					}
				}
			}
			const res = await fetchRest(`/v7/search?${params.toString()}`);
			return res.jsonParsed(searchProfilesResponseSchema);
		},
		staleTime: 5 * 60 * 1000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}
