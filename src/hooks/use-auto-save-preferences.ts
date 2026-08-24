/**
 * Auto-save preferences to Supabase user metadata.
 * Uses debounced writes to avoid excessive API calls.
 * Falls back to localStorage when offline or not authenticated.
 */
import { useEffect, useRef, useCallback } from "react";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import {
	getPreferences,
	setPreferences,
	type Preferences,
} from "#/domains/settings/preferences";

const AUTOSAVE_DEBOUNCE_MS = 2000;
const METADATA_KEY = "app_preferences";

/**
 * Hydrate preferences from Supabase user metadata on mount.
 * Falls back to localStorage if no metadata exists.
 */
export function useAutoSavePreferences() {
	const { user } = useSupabaseSession();
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mountedRef = useRef(false);

	// Hydrate from Supabase metadata on user change
	useEffect(() => {
		if (!user) return;

		const metadata = user.user_metadata as Record<string, unknown> | undefined;
		const remotePrefs = metadata?.[METADATA_KEY];

		if (remotePrefs && typeof remotePrefs === "object") {
			// Merge remote prefs with local defaults
			setPreferences(remotePrefs as Partial<Preferences>);
		}
	}, [user]);

	// Watch for preference changes and auto-save
	useEffect(() => {
		if (!user) return;

		// Set up a storage event listener for cross-tab sync
		const handler = (e: StorageEvent) => {
			if (e.key === "fyk:app-data:preferences.data" && e.newValue) {
				try {
					const decoded = JSON.parse(atob(e.newValue));
					setPreferences(decoded);
				} catch {
					// ignore parse errors
				}
			}
		};

		window.addEventListener("storage", handler);
		return () => window.removeEventListener("storage", handler);
	}, [user]);

	// Cleanup timer
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}
		};
	}, []);

	return { saveTimerRef, mountedRef };
}

/**
 * Save preferences to Supabase user metadata (debounced).
 */
export function useSaveToSupabase() {
	const { user } = useSupabaseSession();
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const saveToSupabase = useCallback(
		(prefs: Preferences) => {
			if (!user) return;

			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}

			saveTimerRef.current = setTimeout(async () => {
				try {
					const { supabase } = await import(
						"#/integrations/supabase/client"
					);
					await supabase.auth.updateUser({
						data: {
							[METADATA_KEY]: prefs,
						},
					});
				} catch (err) {
					console.error("[auto-save] Failed to save to Supabase:", err);
				}
			}, AUTOSAVE_DEBOUNCE_MS);
		},
		[user],
	);

	return { saveToSupabase };
}
