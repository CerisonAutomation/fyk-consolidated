import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

const accountPreferencesSchema = z.record(z.string(), z.unknown());
export type AccountPreferences = z.infer<typeof accountPreferencesSchema>;

export type AccountPreferencesPatch = {
	settings: Partial<AccountPreferences>;
};

// -- Query keys --

export const settingsKeys = {
	all: ["settings"] as const,
	accountPreferences: () =>
		[...settingsKeys.all, "accountPreferences"] as const,
};

// -- Hooks --

/**
 * Fetch account preferences.
 * Maps to getAccountPreferences from open-grind.
 */
export function useAccountPreferences() {
	return useQuery<AccountPreferences, ApiError>({
		queryKey: settingsKeys.accountPreferences(),
		queryFn: async () => {
			const res = await fetchRest("/v3/me/prefs/settings");
			return res.jsonParsed(accountPreferencesSchema);
		},
		staleTime: 5 * 60 * 1000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Update account preferences.
 * Maps to setAccountPreferences from open-grind.
 */
export function useSetAccountPreferences() {
	const queryClient = useQueryClient();

	return useMutation<void, ApiError, AccountPreferencesPatch>({
		mutationFn: async (settings) => {
			const res = await fetchRest("/v3/me/prefs/settings", {
				method: "PUT",
				body: settings,
			});
			res.assertOk();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: settingsKeys.accountPreferences(),
			});
		},
	});
}
