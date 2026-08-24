import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
	getAccountPreferences as getAccountPreferencesDb,
	setAccountPreferences as setAccountPreferencesDb,
} from "../supabase/index";

// -- Schemas --

export const accountPreferencesSchema = z.record(z.unknown());
export type AccountPreferences = Record<string, unknown>;

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
 * Now powered by Supabase.
 */
export function useAccountPreferences() {
	return useQuery<AccountPreferences, Error>({
		queryKey: settingsKeys.accountPreferences(),
		queryFn: async () => {
			const prefs = await getAccountPreferencesDb();
			return (prefs ?? {}) as AccountPreferences;
		},
		staleTime: 5 * 60 * 1000,
	});
}

/**
 * Update account preferences.
 * Now powered by Supabase.
 */
export function useSetAccountPreferences() {
	const queryClient = useQueryClient();

	return useMutation<void, Error, AccountPreferencesPatch>({
		mutationFn: async (settings) => {
			await setAccountPreferencesDb(
				settings.settings as Record<string, unknown>,
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: settingsKeys.accountPreferences(),
			});
		},
	});
}
