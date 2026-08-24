import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
	getConversations as getConversationsDb,
	deleteConversation,
	pinConversation,
	muteConversation,
	markRead,
} from "../supabase/index";

// -- Schemas --

export const fullConversationSchema = z.record(z.string(), z.unknown());
export type Conversation = z.infer<typeof fullConversationSchema>;

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
 * Now powered by Supabase.
 */
export function useConversations(
	page: number = 1,
	_filters: InboxFilterRequest | null = null,
) {
	return useQuery<{ entries: unknown[]; nextPage: number | null }, Error>({
		queryKey: conversationKeys.page(page, _filters),
		queryFn: async () => {
			return await getConversationsDb(page);
		},
		staleTime: 30_000,
	});
}

/**
 * Mark a conversation as read.
 * Now powered by Supabase.
 */
export function useMarkRead() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{ conversationId: string; messageId?: string }
	>({
		mutationFn: async ({ conversationId }) => {
			await markRead(conversationId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: conversationKeys.all });
		},
	});
}

/**
 * Delete a conversation for the current user.
 * Now powered by Supabase.
 */
export function useDeleteConversation() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, { conversationId: string }>({
		mutationFn: async ({ conversationId }) => {
			await deleteConversation(conversationId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: conversationKeys.all });
		},
	});
}

/**
 * Pin or unpin a conversation.
 * Now powered by Supabase.
 */
export function usePinConversation() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{ conversationId: string; pinned: boolean }
	>({
		mutationFn: async ({ conversationId, pinned }) => {
			await pinConversation(conversationId, pinned);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: conversationKeys.all });
		},
	});
}

/**
 * Mute or unmute a conversation.
 * Now powered by Supabase.
 */
export function useMuteConversation() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{ conversationId: string; muted: boolean }
	>({
		mutationFn: async ({ conversationId, muted }) => {
			await muteConversation(conversationId, muted);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: conversationKeys.all });
		},
	});
}
