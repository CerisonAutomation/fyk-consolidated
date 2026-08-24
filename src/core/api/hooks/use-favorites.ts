import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
	addFavorite as addFavoriteDb,
	removeFavorite as removeFavoriteDb,
} from "../supabase/index";
import { supabase } from "#/integrations/supabase/client";

// -- Schemas --

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
 * Now powered by Supabase.
 */
export function useAddFavorite() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, { profileId: number }>({
		mutationFn: async ({ profileId }) => {
			await addFavoriteDb(profileId);
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
 * Now powered by Supabase.
 */
export function useRemoveFavorite() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, { profileId: number }>({
		mutationFn: async ({ profileId }) => {
			await removeFavoriteDb(profileId);
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
 * Now powered by Supabase.
 */
export function useFavoriteNote(profileId: number | null | undefined) {
	return useQuery<FavoriteNote, Error>({
		queryKey: favoriteKeys.note(profileId ?? 0),
		queryFn: async () => {
			const { data } = await supabase
				.from("Profile")
				.select("favoriteNote, favoritePhone")
				.eq("id", profileId!)
				.single();
			return {
				notes: (data?.favoriteNote as string) ?? "",
				phoneNumber: (data?.favoritePhone as string) ?? "",
			};
		},
		enabled: profileId !== null && profileId !== undefined,
		staleTime: 60_000,
	});
}

/**
 * Update a favorite note.
 * Now powered by Supabase.
 */
export function usePutFavoriteNote() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{ profileId: number; note: FavoriteNote }
	>({
		mutationFn: async ({ profileId, note }) => {
			const { error } = await supabase
				.from("Profile")
				.update({
					favoriteNote: note.notes,
					favoritePhone: note.phoneNumber,
				})
				.eq("id", profileId);
			if (error) throw new Error(error.message);
		},
		onSuccess: (_data, { profileId, note }) => {
			queryClient.setQueryData<FavoriteNote>(
				favoriteKeys.note(profileId),
				note,
			);
		},
	});
}
