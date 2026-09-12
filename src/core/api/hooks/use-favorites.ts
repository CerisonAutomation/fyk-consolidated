import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "#/lib/client";

/**
 * The star on a card. `POST /api/social { action }` owns the toggle, so two tabs
 * cannot disagree: the row either exists or it does not, and the unique
 * `(user_id, target_id)` constraint settles the race.
 *
 * The per-favourite *note* that the previous screen carried (`{ notes, phoneNumber }`)
 * has no column here — the app's private notes live in `user_notes` and are read
 * through `/api/interest/notes` — so no note hook is exported rather than a hook
 * that would write to a table nobody reads.
 */
export const favoriteKeys = {
	all: ["favorites"] as const,
	list: () => [...favoriteKeys.all, "list"] as const,
};

export function useFavorites() {
	return useQuery<{ profileId: string }[], Error>({
		queryKey: favoriteKeys.list(),
		queryFn: () =>
			api<{ favourites: { profile: { id: string } }[] }>("/api/social?view=favourites").then(
				(response) => response.favourites.map((entry) => ({ profileId: entry.profile.id })),
			),
		staleTime: 30_000,
		retry: false,
	});
}

function favoriteMutation(action: "favourite" | "unfavourite") {
	return function useFavoriteAction() {
		const queryClient = useQueryClient();
		return useMutation<{ isFavourite: boolean }, Error, { profileId: string }>({
			mutationFn: ({ profileId }) =>
				api<{ isFavourite: boolean }>("/api/social", {
					method: "POST",
					body: { targetId: profileId, action },
				}),
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
				queryClient.invalidateQueries({ queryKey: ["discover"] });
				queryClient.invalidateQueries({ queryKey: ["interest"] });
			},
		});
	};
}

export const useAddFavorite = favoriteMutation("favourite");
export const useRemoveFavorite = favoriteMutation("unfavourite");
