import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

export const tapProfileSchema = z.record(z.string(), z.unknown());
export type TapProfile = z.infer<typeof tapProfileSchema>;

export type TapType = number;

const getReceivedTapsResponseSchema = z.object({
	profiles: z.array(tapProfileSchema),
});

const sendTapResponseSchema = z.object({ isMutual: z.boolean() });

// -- Query keys --

export const tapKeys = {
	all: ["taps"] as const,
	received: () => [...tapKeys.all, "received"] as const,
};

// -- Hooks --

/**
 * Fetch received taps.
 * Maps to getReceivedTaps from open-grind.
 */
export function useReceivedTaps() {
	return useQuery<{ profiles: TapProfile[] }, ApiError>({
		queryKey: tapKeys.received(),
		queryFn: async () => {
			const res = await fetchRest("/v2/taps/received");
			return res.jsonParsed(getReceivedTapsResponseSchema);
		},
		staleTime: 60_000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Send a tap.
 * Maps to sendTap from open-grind.
 */
export function useSendTap() {
	const queryClient = useQueryClient();

	return useMutation<
		{ isMutual: boolean },
		ApiError,
		{
			recipientId: number;
			tapType: TapType;
		}
	>({
		mutationFn: async ({ recipientId, tapType }) => {
			const res = await fetchRest("/v2/taps/add", {
				method: "POST",
				body: { recipientId, tapType },
			});
			return res.jsonParsed(sendTapResponseSchema);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: tapKeys.all });
		},
	});
}
