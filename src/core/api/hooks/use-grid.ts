import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import {
	getGridProfiles,
	searchProfiles as searchProfilesDb,
} from "../supabase/index";

// -- Schemas (inlined from open-grind model) --

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
 * Now powered by Supabase.
 */
export function useCascadeV4(query: CascadeV4Query) {
	return useQuery<{ items: Array<{ type: string; data: Record<string, unknown> }>; nextPage: number | null }, Error>({
		queryKey: gridKeys.cascade(query),
		queryFn: async () => {
			const result = await getGridProfiles({
				nearbyGeoHash: query.nearbyGeoHash,
				pageNumber: query.pivot ?? 0,
			});
			return {
				items: result.items,
				nextPage: result.nextPage,
			};
		},
		staleTime: 5 * 60 * 1000,
	});
}

/**
 * Search profiles by filters.
 * Now powered by Supabase.
 */
export function useSearchProfiles(query: SearchQuery) {
	return useQuery<{ profiles: Array<Record<string, unknown>>; total?: number }, Error>({
		queryKey: gridKeys.search(query),
		queryFn: async () => {
			const profiles = await searchProfilesDb({
				ageMin: query.ageMin,
				ageMax: query.ageMax,
			});
			return {
				profiles: profiles.map((p) => p as unknown as Record<string, unknown>),
				total: profiles.length,
			};
		},
		staleTime: 5 * 60 * 1000,
	});
}
