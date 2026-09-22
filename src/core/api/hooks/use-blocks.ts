import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/client";

/**
 * The block list. `blocks` has no Row Level Security (it is not a browser-readable
 * table), so the read goes through `/api/social?view=blocks`, which also hides
 * profiles that were deleted or suspended underneath the edge.
 */
export const blockKeys = {
	all: ["blocks"] as const,
	list: () => [...blockKeys.all, "list"] as const,
};

export type BlockedUser = { profileId: string; blockedTime: number };

export function useBlockedUsers() {
	return useQuery<BlockedUser[], Error>({
		queryKey: blockKeys.list(),
		queryFn: () =>
			api<{
				blocks: { profile: { id: string }; blockedAt?: string; at?: string }[];
			}>("/api/social?view=blocks").then((response) =>
				response.blocks.map((entry) => ({
					profileId: entry.profile.id,
					// Milliseconds, because the screen formats `new Date(blockedTime)`.
					blockedTime:
						Date.parse(entry.at ?? entry.blockedAt ?? "") || Date.now(),
				})),
			),
		staleTime: 5_000,
		retry: false,
	});
}

function blockMutation(action: "block" | "unblock") {
	return function useBlockAction() {
		const queryClient = useQueryClient();
		return useMutation<void, Error, { profileId: string }>({
			mutationFn: async ({ profileId }) => {
				await api("/api/social", {
					method: "POST",
					body: { targetId: profileId, action },
				});
			},
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: blockKeys.all });
				queryClient.invalidateQueries({ queryKey: ["profiles"] });
			},
		});
	};
}

export const useBlockUser = blockMutation("block");
export const useUnblockUser = blockMutation("unblock");
