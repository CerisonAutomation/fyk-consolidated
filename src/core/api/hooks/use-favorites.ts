import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

export const favoriteNoteSchema = z.object({
	notes: z.string(),
	phoneNumber: z.string(),
});
export type FavoriteNote = z.infer<typeof favoriteNoteSchema>;

// -- Query keys --

export const favoriteKeys = {
	all: ["favorites"] as const,
	note: (profileId: number) =>
		[...favoriteKeys.all, "note", profileId] as const,
};

// -- Hooks --

/**
 * Add a user to favorites.
 * Maps to addFavoriteUser from open-grind.
 */
export function useAddFavorite() {
	const queryClient = useQueryClient();

	return useMutation<void, ApiError, { profileId: number }>({
		mutationFn: async ({ profileId }) => {
			const res = await fetchRest(`/v3/me/favorites/${profileId}`, {
				method: "POST",
			});
			res.assertOk();
		},
		onSuccess: (_data, { profileId }) => {
			queryClient.invalidateQueries({
				queryKey: favoriteKeys.note(profileId),
			});
		},
	});
}

/**
 * Remove a user from favorites.
 * Maps to removeFavoriteUser from open-grind.
 */
export function useRemoveFavorite() {
	const queryClient = useQueryClient();

	return useMutation<void, ApiError, { profileId: number }>({
		mutationFn: async ({ profileId }) => {
			const res = await fetchRest(`/v3/me/favorites/${profileId}`, {
				method: "DELETE",
			});
			res.assertOk();
		},
		onSuccess: (_data, { profileId }) => {
			queryClient.invalidateQueries({
				queryKey: favoriteKeys.note(profileId),
			});
		},
	});
}

/**
 * Get a favorite note for a profile.
 * Maps to getFavoriteNote from open-grind.
 */
export function useFavoriteNote(profileId: number | null | undefined) {
	return useQuery<FavoriteNote, ApiError>({
		queryKey: favoriteKeys.note(profileId ?? 0),
		queryFn: async () => {
			const res = await fetchRest(`/v1/favorites/notes/${profileId}`);
			return res.jsonParsed(favoriteNoteSchema);
		},
		enabled: profileId !== null && profileId !== undefined,
		staleTime: 60_000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Update a favorite note.
 * Maps to putFavoriteNote from open-grind.
 */
export function usePutFavoriteNote() {
	const queryClient = useQueryClient();

	return useMutation<void, ApiError, { profileId: number; note: FavoriteNote }>(
		{
			mutationFn: async ({ profileId, note }) => {
				const res = await fetchRest(`/v1/favorites/notes/${profileId}`, {
					method: "PUT",
					body: note,
				});
				res.assertOk();
			},
			onSuccess: (_data, { profileId, note }) => {
				queryClient.setQueryData<FavoriteNote>(
					favoriteKeys.note(profileId),
					note,
				);
			},
		},
	);
}
