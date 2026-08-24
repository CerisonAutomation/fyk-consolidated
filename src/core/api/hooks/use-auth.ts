import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind methods) --

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
 * Maps to login method from open-grind.
 */
export function useLogin() {
	const queryClient = useQueryClient();

	return useMutation<
		LoginResult,
		ApiError,
		{ email: string; password: string }
	>({
		mutationFn: async ({ email, password }) => {
			const res = await fetchRest("/api/auth/login", {
				method: "POST",
				body: { email, password },
			});
			return res.jsonParsed(loginResultSchema);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: authKeys.all });
		},
	});
}

/**
 * Logout.
 * Maps to logout method from open-grind.
 */
export function useLogout() {
	const queryClient = useQueryClient();

	return useMutation<void, ApiError>({
		mutationFn: async () => {
			const res = await fetchRest("/api/auth/logout", {
				method: "POST",
			});
			res.assertOk();
		},
		onSuccess: () => {
			queryClient.clear();
		},
	});
}

/**
 * Check authentication state.
 * Maps to auth_state method from open-grind.
 */
export function useAuthState() {
	return useQuery<number | null, ApiError>({
		queryKey: authKeys.authState(),
		queryFn: async () => {
			const res = await fetchRest("/api/auth/state");
			return res.json() as number | null;
		},
		staleTime: 30_000,
		retry: false,
	});
}

/**
 * Check session health.
 * Maps to session_health method from open-grind.
 */
export function useSessionHealth() {
	return useQuery<SessionHealth, ApiError>({
		queryKey: authKeys.sessionHealth(),
		queryFn: async () => {
			const res = await fetchRest("/api/auth/session-health");
			return res.jsonParsed(sessionHealthSchema);
		},
		staleTime: 60_000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}
