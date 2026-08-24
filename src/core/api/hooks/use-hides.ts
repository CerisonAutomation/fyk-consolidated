import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
	getHiddenUsers as getHiddenUsersDb,
	hideUser as hideUserDb,
	unhideUser as unhideUserDb,
} from "../supabase/index";

// -- Schemas --

const getHiddenUsersResponseSchema = z.object({
	hides: z.array(z.object({ profileId: z.coerce.number() })),
});

type HiddenUsers = z.infer<typeof getHiddenUsersResponseSchema>["hides"];

// -- Query keys --

export const hideKeys = {
	all: ["hides"] as const,
	list: () => [...hideKeys.all, "list"] as const,
};

// -- Hooks --

/**
 * Fetch hidden users list.
 * Now powered by Supabase.
 */
export function useHiddenUsers() {
	return useQuery<HiddenUsers, Error>({
		queryKey: hideKeys.list(),
		queryFn: async () => {
			return await getHiddenUsersDb();
		},
		staleTime: 5_000,
	});
}

/**
 * Hide a user.
 * Now powered by Supabase.
 */
export function useHideUser() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, { profileId: number }>({
		mutationFn: async ({ profileId }) => {
			await hideUserDb(profileId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: hideKeys.all });
		},
	});
}

/**
 * Unhide a user.
 * Now powered by Supabase.
 */
export function useUnhideUser() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, { profileId: number }>({
		mutationFn: async ({ profileId }) => {
			await unhideUserDb(profileId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: hideKeys.all });
		},
	});
}
