import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

const gendersSchema = z.object({
	genders: z.array(z.record(z.string(), z.unknown())),
});

const pronounsSchema = z.object({
	pronouns: z.array(z.record(z.string(), z.unknown())),
});

const profileTagsResponseSchema = z.object({
	tags: z.array(z.record(z.string(), z.unknown())),
});

// -- Query keys --

export const referenceKeys = {
	all: ["reference"] as const,
	genders: () => [...referenceKeys.all, "genders"] as const,
	pronouns: () => [...referenceKeys.all, "pronouns"] as const,
	tags: () => [...referenceKeys.all, "tags"] as const,
};

// -- Hooks --

/**
 * Fetch available genders.
 * Maps to getGenders from open-grind.
 * Uses staleTime: Infinity since this data is static.
 */
export function useGenders() {
	return useQuery<z.infer<typeof gendersSchema>, ApiError>({
		queryKey: referenceKeys.genders(),
		queryFn: async () => {
			const res = await fetchRest("/public/v2/genders");
			return res.jsonParsed(gendersSchema);
		},
		staleTime: Infinity,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Fetch available pronouns.
 * Maps to getPronouns from open-grind.
 * Uses staleTime: Infinity since this data is static.
 */
export function usePronouns() {
	return useQuery<z.infer<typeof pronounsSchema>, ApiError>({
		queryKey: referenceKeys.pronouns(),
		queryFn: async () => {
			const res = await fetchRest("/v1/pronouns");
			return res.jsonParsed(pronounsSchema);
		},
		staleTime: Infinity,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Fetch available profile tags.
 * Maps to getTags from open-grind.
 * Uses staleTime: Infinity since this data is static.
 */
export function useTags() {
	return useQuery<z.infer<typeof profileTagsResponseSchema>, ApiError>({
		queryKey: referenceKeys.tags(),
		queryFn: async () => {
			const res = await fetchRest("/v1/tags");
			return res.jsonParsed(profileTagsResponseSchema);
		},
		staleTime: Infinity,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}
