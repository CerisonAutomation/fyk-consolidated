import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

export const apiResponseMessageSchema = z.record(z.string(), z.unknown());
export type ApiResponseMessage = z.infer<typeof apiResponseMessageSchema>;

const outboundMessageSchema = z.object({
	type: z.number(),
	body: z.string(),
});
export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

const conversationMessagesSchema = z.object({
	lastReadTimestamp: z.number().nullable(),
	messages: z.array(apiResponseMessageSchema),
	profile: z.object({
		distance: z.number().nullable(),
		mediaHash: z.string().nullable(),
		name: z.string().nullable(),
		onlineUntil: z.number().nullable(),
		profileId: z.number(),
		showDistance: z.boolean(),
	}),
});

// -- Query keys --

export const messageKeys = {
	all: ["messages"] as const,
	conversation: (conversationId: string) =>
		[...messageKeys.all, "conversation", conversationId] as const,
};

// -- Hooks --

/**
 * Fetch messages for a conversation.
 * Maps to getConversationMessages from open-grind.
 */
export function useConversationMessages(
	conversationId: string | null | undefined,
) {
	return useQuery<z.infer<typeof conversationMessagesSchema>, ApiError>({
		queryKey: messageKeys.conversation(conversationId ?? ""),
		queryFn: async () => {
			const params = new URLSearchParams({ profile: "true" });
			const res = await fetchRest(
				`/v5/chat/conversation/${conversationId}/message?${params.toString()}`,
				{ method: "GET" },
			);
			if (res.status === 403) {
				throw new ApiError({
					message: `Conversation ${conversationId} is no longer available`,
					request: {
						method: "GET",
						path: `/v5/chat/conversation/${conversationId}/message`,
					},
					response: { status: 403, body: res.text() },
				});
			}
			res.assertOk();
			return res.jsonParsed(conversationMessagesSchema);
		},
		enabled: conversationId !== null && conversationId !== undefined,
		staleTime: 10_000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Send a message.
 * Maps to sendMessage from open-grind.
 */
export function useSendMessage() {
	const queryClient = useQueryClient();

	return useMutation<
		ApiResponseMessage,
		ApiError,
		{
			toUserId: number;
			message: OutboundMessage;
			replyToMessageId?: string;
		}
	>({
		mutationFn: async ({ toUserId, message, replyToMessageId }) => {
			const body: Record<string, unknown> = {
				type: message.type,
				target: { type: "Direct", targetId: toUserId },
				body: message.body,
			};
			if (replyToMessageId !== undefined) {
				body.replyToMessageId = replyToMessageId;
			}
			const res = await fetchRest("/v4/chat/message/send", {
				method: "POST",
				body,
			});
			return res.jsonParsed(apiResponseMessageSchema);
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
 * Maps to reactToMessage from open-grind.
 */
export function useReactToMessage() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{
			conversationId: string;
			messageId: string;
			reactionType: number;
		}
	>({
		mutationFn: async ({ conversationId, messageId, reactionType }) => {
			await fetchRest("/v4/chat/message/reaction", {
				method: "POST",
				body: { conversationId, messageId, reactionType },
			});
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
 * Maps to deleteMessageForMe from open-grind.
 */
export function useDeleteMessage() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{
			conversationId: string;
			messageId: string;
		}
	>({
		mutationFn: async ({ conversationId, messageId }) => {
			const res = await fetchRest("/v4/chat/message/delete", {
				method: "POST",
				body: { conversationId, messageId },
			});
			res.assertOk();
		},
		onSuccess: (_data, { conversationId }) => {
			queryClient.invalidateQueries({
				queryKey: messageKeys.conversation(conversationId),
			});
		},
	});
}
