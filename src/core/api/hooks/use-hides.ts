import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/client";
import { blockKeys } from "./use-blocks";

/**
 * "Hide this person from me" — `public.hides`, added by `0018`.
 *
 * Until that table existed there was nothing to write: `/settings/hidden` was
 * pointed at `users.hidden`, which is *someone's own* "hide my profile" switch.
 * Reading or clearing it as a viewer would have edited a stranger's privacy
 * setting, so the screen read an empty list and the action silently missed.
 */
export const hideKeys = {
	all: ["hides"] as const,
	list: () => [...hideKeys.all, "list"] as const,
};

export type HiddenUser = { profileId: string };

export function useHiddenUsers() {
	return useQuery<HiddenUser[], Error>({
		queryKey: hideKeys.list(),
		queryFn: () =>
			api<{ hides: { profile: { id: string } }[] }>(
				"/api/social?view=hides",
			).then((response) =>
				response.hides.map((entry) => ({ profileId: entry.profile.id })),
			),
		staleTime: 5_000,
		retry: false,
	});
}

function hideMutation(action: "hide" | "unhide") {
	return function useHideAction() {
		const queryClient = useQueryClient();
		return useMutation<void, Error, { profileId: string }>({
			mutationFn: async ({ profileId }) => {
				await api("/api/social", {
					method: "POST",
					body: { targetId: profileId, action },
				});
			},
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: hideKeys.all });
				// The deck is the other place a hidden person disappears from.
				queryClient.invalidateQueries({ queryKey: ["discover"] });
				queryClient.invalidateQueries({ queryKey: blockKeys.all });
			},
		});
	};
}

export const useHideUser = hideMutation("hide");
export const useUnhideUser = hideMutation("unhide");
