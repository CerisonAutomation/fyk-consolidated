import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
	getBlockedUsers as getBlockedUsersDb,
	blockUser as blockUserDb,
	unblockUser as unblockUserDb,
} from "../supabase/index";

// -- Schemas --

const getBlockedUsersResponseSchema = z.object({
	blocking: z.array(
		z.object({ profileId: z.number(), blockedTime: z.number() }),
	),
});

type BlockedUsers = z.infer<typeof getBlockedUsersResponseSchema>["blocking"];

// -- Query keys --

export const blockKeys = {
	all: ["blocks"] as const,
	list: () => [...blockKeys.all, "list"] as const,
};

// -- Hooks --

/**
 * Fetch blocked users list.
 * Now powered by Supabase.
 */
export function useBlockedUsers() {
	return useQuery<BlockedUsers, Error>({
		queryKey: blockKeys.list(),
		queryFn: async () => {
			return await getBlockedUsersDb();
		},
		staleTime: 5_000,
	});
}

/**
 * Block a user.
 * Now powered by Supabase.
 */
export function useBlockUser() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, { profileId: number }>({
		mutationFn: async ({ profileId }) => {
			await blockUserDb(profileId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: blockKeys.all });
		},
	});
}

/**
 * Unblock a user.
 * Now powered by Supabase.
 */
export function useUnblockUser() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, { profileId: number }>({
		mutationFn: async ({ profileId }) => {
			await unblockUserDb(profileId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: blockKeys.all });
		},
	});
}
