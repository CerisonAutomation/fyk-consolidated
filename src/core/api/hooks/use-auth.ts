import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { getMyProfileId } from "../supabase/index";
import { authClient } from "#/lib/auth-client";

// -- Schemas --

const restrictionSchema = z.object({
	kind: z.string(),
	code: z.number(),
	message: z.string(),
	reason: z.string().nullish(),
	subReason: z.string().nullish(),
	automated: z.boolean().nullish(),
});

export type Restriction = z.infer<typeof restrictionSchema>;

const loginResultSchema = z.object({
	profileId: z.coerce.number().int().nonnegative(),
	restriction: restrictionSchema.nullish(),
});

export type LoginResult = z.infer<typeof loginResultSchema>;

const sessionHealthSchema = z.object({
	signedIn: z.boolean(),
	expiresAt: z.number().nonnegative().nullable(),
	stale: z.boolean(),
});

export type SessionHealth = z.infer<typeof sessionHealthSchema>;

// -- Query keys --

export const authKeys = {
	all: ["auth"] as const,
	authState: () => [...authKeys.all, "authState"] as const,
	sessionHealth: () => [...authKeys.all, "sessionHealth"] as const,
};

// -- Hooks --

/**
 * Login with email and password.
 * Uses better-auth client for session management.
 */
export function useLogin() {
	const queryClient = useQueryClient();

	return useMutation<
		LoginResult,
		Error,
		{ email: string; password: string }
	>({
		mutationFn: async ({ email, password }) => {
			const { error } = await authClient.signIn.email({
					email,
					password,
				});
				if (error) throw new Error(error.message ?? "Login failed");

			const profileId = await getMyProfileId();
			return {
				profileId: profileId ?? 0,
				restriction: null,
			};
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: authKeys.all });
		},
	});
}

/**
 * Logout.
 * Uses better-auth client for session management.
 */
export function useLogout() {
	const queryClient = useQueryClient();

	return useMutation<void, Error>({
		mutationFn: async () => {
			await authClient.signOut();
		},
		onSuccess: () => {
			queryClient.clear();
		},
	});
}

/**
 * Check authentication state.
 * Returns the current user's profile ID from Supabase.
 */
export function useAuthState() {
	return useQuery<number | null, Error>({
		queryKey: authKeys.authState(),
		queryFn: async () => {
			const profileId = await getMyProfileId();
			return profileId;
		},
		staleTime: 30_000,
		retry: false,
	});
}

/**
 * Check session health.
 * Uses better-auth session.
 */
export function useSessionHealth() {
	return useQuery<SessionHealth, Error>({
		queryKey: authKeys.sessionHealth(),
		queryFn: async () => {
			const { data: session } = await authClient.getSession();
			return {
				signedIn: !!session,
				expiresAt: null,
				stale: false,
			};
		},
		staleTime: 60_000,
	});
}
