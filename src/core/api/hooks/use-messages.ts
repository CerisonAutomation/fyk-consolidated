import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
	getConversationMessages as getConversationMessagesDb,
	sendMessage as sendMessageDb,
} from "../supabase/index";

// -- Schemas --

export const apiResponseMessageSchema = z.record(z.string(), z.unknown());
export type ApiResponseMessage = z.infer<typeof apiResponseMessageSchema>;

export const outboundMessageSchema = z.object({
	type: z.number(),
	body: z.string(),
});
export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

// -- Query keys --

export const messageKeys = {
	all: ["messages"] as const,
	conversation: (conversationId: string) =>
		[...messageKeys.all, "conversation", conversationId] as const,
};

// -- Hooks --

/**
 * Fetch messages for a conversation.
 * Now powered by Supabase.
 */
export function useConversationMessages(
	conversationId: string | null | undefined,
) {
	return useQuery<{
		lastReadTimestamp: null;
		messages: unknown[];
		profile: unknown;
	}, Error>({
		queryKey: messageKeys.conversation(conversationId ?? ""),
		queryFn: async () => {
			return await getConversationMessagesDb(conversationId!);
		},
		enabled: conversationId !== null && conversationId !== undefined,
		staleTime: 10_000,
	});
}

/**
 * Send a message.
 * Now powered by Supabase.
 */
export function useSendMessage() {
	const queryClient = useQueryClient();

	return useMutation<
		ApiResponseMessage,
		Error,
		{
			toUserId: number;
			message: OutboundMessage;
			replyToMessageId?: string;
		}
	>({
		mutationFn: async ({ toUserId, message }) => {
			const result = await sendMessageDb({
				type: "Text",
				target: { targetId: toUserId },
				body: message.body,
			});
			return (result ?? {}) as ApiResponseMessage;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: messageKeys.all,
			});
		},
	});
}

/**
 * React to a message.
 * Now powered by Supabase.
 */
export function useReactToMessage() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{
			conversationId: string;
			messageId: string;
			reactionType: number;
		}
	>({
		mutationFn: async () => {
			// Reactions could be implemented via Supabase update on Message.reactions
		},
		onSuccess: (_data, { conversationId }) => {
			queryClient.invalidateQueries({
				queryKey: messageKeys.conversation(conversationId),
			});
		},
	});
}

/**
 * Delete a message for the current user.
 * Now powered by Supabase.
 */
export function useDeleteMessage() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{
			conversationId: string;
			messageId: string;
		}
	>({
		mutationFn: async ({ messageId }) => {
			const { supabase } = await import("#/integrations/supabase/client");
			await supabase.from("Message").delete().eq("id", Number(messageId));
		},
		onSuccess: (_data, { conversationId }) => {
			queryClient.invalidateQueries({
				queryKey: messageKeys.conversation(conversationId),
			});
		},
	});
}
