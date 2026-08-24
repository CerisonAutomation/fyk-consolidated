import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

export const fullConversationSchema = z.record(z.unknown());
export type Conversation = z.infer<typeof fullConversationSchema>;

const conversationsSchema = z.object({
	entries: z.array(fullConversationSchema),
	nextPage: z.number().nullable(),
});

export type InboxFilterRequest = {
	unreadOnly: boolean;
	chemistryOnly: boolean;
	favoritesOnly: boolean;
	rightNowOnly: boolean;
	onlineNowOnly: boolean;
	distanceMeters: number | null;
	positions: number[];
};

// -- Query keys --

export const conversationKeys = {
	all: ["conversations"] as const,
	page: (page: number, filters: InboxFilterRequest | null) =>
		[...conversationKeys.all, "page", page, filters] as const,
};

// -- Hooks --

/**
 * Fetch conversations list.
 * Maps to getConversations from open-grind.
 */
export function useConversations(
	page: number = 1,
	filters: InboxFilterRequest | null = null,
) {
	return useQuery<
		z.infer<typeof conversationsSchema>,
		ApiError
	>({
		queryKey: conversationKeys.page(page, filters),
		queryFn: async () => {
			const params = new URLSearchParams({ page: String(page) });
			const res = await fetchRest(
				`/v4/inbox?${params.toString()}`,
				{
					method: "POST",
					...(filters ? { body: filters } : {}),
				},
			);
			return res.jsonParsed(conversationsSchema);
		},
		staleTime: 30_000,
		retry: (count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Mark a conversation as read.
 * Maps to markConversationAsRead from open-grind.
 */
export function useMarkRead() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{
			conversationId: string;
			messageId?: string;
		}
	>({
		mutationFn: async ({
			conversationId,
			messageId = "0:00000000-0000-0000-0000-000000000000",
		}) => {
			const res = await fetchRest(
				`/v4/chat/conversation/${conversationId}/read/${messageId}`,
				{ method: "POST" },
			);
			res.assertOk();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: conversationKeys.all });
		},
	});
}

/**
 * Delete a conversation for the current user.
 * Maps to deleteConversationForMe from open-grind.
 */
export function useDeleteConversation() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{ conversationId: string }
	>({
		mutationFn: async ({ conversationId }) => {
			const res = await fetchRest(
				`/v4/chat/conversation/${conversationId}`,
				{ method: "DELETE" },
			);
			res.assertOk();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: conversationKeys.all });
		},
	});
}

/**
 * Pin or unpin a conversation.
 * Maps to setConversationPinned from open-grind.
 */
export function usePinConversation() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{ conversationId: string; pinned: boolean }
	>({
		mutationFn: async ({ conversationId, pinned }) => {
			const res = await fetchRest(
				`/v4/chat/conversation/${conversationId}/${pinned ? "pin" : "unpin"}`,
				{ method: "POST" },
			);
			res.assertOk();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: conversationKeys.all });
		},
	});
}

/**
 * Mute or unmute a conversation.
 * Maps to setConversationMuted from open-grind.
 */
export function useMuteConversation() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{ conversationId: string; muted: boolean }
	>({
		mutationFn: async ({ conversationId, muted }) => {
			const res = await fetchRest(
				`/v1/push/conversation/${conversationId}/${muted ? "mute" : "unmute"}`,
				{ method: "POST" },
			);
			res.assertOk();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: conversationKeys.all });
		},
	});
}
