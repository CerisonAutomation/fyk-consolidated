import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/client";

/**
 * Taps. `POST /api/taps` is the one writer: it records the edge, finds a mutual
 * tap inside the same transaction and creates the match, so two screens cannot
 * produce two answers. `tapType` is kept as a number because the callers still
 * pass the open-grind codes (`1` like, `2` super); it maps onto the `type`
 * column's own vocabulary.
 */
export type TapType = 1 | 2;

export const tapKeys = {
	all: ["taps"] as const,
	received: () => [...tapKeys.all, "received"] as const,
	sent: () => [...tapKeys.all, "sent"] as const,
};

export function useReceivedTaps() {
	return useQuery<{ profiles: Record<string, unknown>[] }, Error>({
		queryKey: tapKeys.received(),
		queryFn: () =>
			api<{ profiles: Record<string, unknown>[] }>("/api/interest/likes").then(
				(response) => ({ profiles: response.profiles }),
			),
		staleTime: 30_000,
		retry: false,
	});
}

export function useTapsSent() {
	return useQuery<{ profiles: Record<string, unknown>[] }, Error>({
		queryKey: tapKeys.sent(),
		queryFn: () =>
			api<{ profiles: Record<string, unknown>[] }>("/api/interest/taps").then(
				(response) => ({ profiles: response.profiles }),
			),
		staleTime: 30_000,
		retry: false,
	});
}

export function useSendTap() {
	const queryClient = useQueryClient();
	return useMutation<
		{ isMutual: boolean },
		Error,
		{ recipientId: string; tapType?: TapType }
	>({
		mutationFn: ({ recipientId, tapType = 1 }) =>
			api<{ isMatch: boolean }>("/api/taps", {
				method: "POST",
				body: { targetId: recipientId, type: tapType === 2 ? "woof" : "like" },
			}).then((response) => ({ isMutual: response.isMatch })),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: tapKeys.all });
			queryClient.invalidateQueries({ queryKey: ["discover"] });
			queryClient.invalidateQueries({ queryKey: ["interest"] });
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
		},
	});
}

/** Undo, before it became a match: removes the row, not just the client state. */
export function useUndoTap() {
	const queryClient = useQueryClient();
	return useMutation<{ undone: boolean }, Error, { recipientId: string }>({
		mutationFn: ({ recipientId }) =>
			api<{ undone: boolean }>(
				`/api/taps?targetId=${encodeURIComponent(recipientId)}`,
				{
					method: "DELETE",
				},
			),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: tapKeys.all }),
	});
}
