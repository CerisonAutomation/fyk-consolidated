import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
	getReceivedTaps as getReceivedTapsDb,
	sendTap as sendTapDb,
} from "../supabase/index";

// -- Schemas --

export const tapProfileSchema = z.record(z.unknown());
export type TapProfile = Record<string, unknown>;

export type TapType = number;

// -- Query keys --

export const tapKeys = {
	all: ["taps"] as const,
	received: () => [...tapKeys.all, "received"] as const,
};

// -- Hooks --

/**
 * Fetch received taps.
 * Now powered by Supabase.
 */
export function useReceivedTaps() {
	return useQuery<{ profiles: TapProfile[] }, Error>({
		queryKey: tapKeys.received(),
		queryFn: async () => {
			const taps = await getReceivedTapsDb();
			return { profiles: taps as unknown as TapProfile[] };
		},
		staleTime: 60_000,
	});
}

/**
 * Send a tap.
 * Now powered by Supabase.
 */
export function useSendTap() {
	const queryClient = useQueryClient();

	return useMutation<
		{ isMutual: boolean },
		Error,
		{
			recipientId: number;
			tapType: TapType;
		}
	>({
		mutationFn: async ({ recipientId, tapType }) => {
			return await sendTapDb(recipientId, tapType);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: tapKeys.all });
		},
	});
}
