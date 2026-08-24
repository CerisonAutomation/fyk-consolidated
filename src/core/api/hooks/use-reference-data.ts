import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// -- Schemas --

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

// -- Static reference data (no external API needed) --

const STATIC_GENDERS = [
	{ id: 1, name: "Male" },
	{ id: 2, name: "Female" },
	{ id: 3, name: "Non-binary" },
	{ id: 4, name: "Other" },
];

const STATIC_PRONOUNS = [
	{ id: 1, name: "He/Him" },
	{ id: 2, name: "She/Her" },
	{ id: 3, name: "They/Them" },
];

const STATIC_TAGS = [
	{ id: 1, name: "Geek" },
	{ id: 2, name: "Bear" },
	{ id: 3, name: "Twink" },
	{ id: 4, name: "Daddy" },
	{ id: 5, name: "Jock" },
	{ id: 6, name: "Otter" },
	{ id: 7, name: "Wolf" },
];

// -- Hooks --

/**
 * Fetch available genders.
 * Returns static data.
 */
export function useGenders() {
	return useQuery<z.infer<typeof gendersSchema>, Error>({
		queryKey: referenceKeys.genders(),
		queryFn: async () => {
			return { genders: STATIC_GENDERS };
		},
		staleTime: Infinity,
	});
}

/**
 * Fetch available pronouns.
 * Returns static data.
 */
export function usePronouns() {
	return useQuery<z.infer<typeof pronounsSchema>, Error>({
		queryKey: referenceKeys.pronouns(),
		queryFn: async () => {
			return { pronouns: STATIC_PRONOUNS };
		},
		staleTime: Infinity,
	});
}

/**
 * Fetch available profile tags.
 * Returns static data.
 */
export function useTags() {
	return useQuery<z.infer<typeof profileTagsResponseSchema>, Error>({
		queryKey: referenceKeys.tags(),
		queryFn: async () => {
			return { tags: STATIC_TAGS };
		},
		staleTime: Infinity,
	});
}
