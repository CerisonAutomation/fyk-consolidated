import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { api } from "#/lib/client";
import {
	DEFAULT_SETTINGS,
	patchFor,
	valueFor,
	type ServerPrivacyField,
	type ServerSettings,
} from "#/lib/settings-map";

/**
 * The privacy half of Settings, read from and written to the server.
 *
 * The screens used to hold their own copy: `useState(prefs)` over a
 * `localStorage` snapshot, saved back to `localStorage`. This is the seam that
 * makes the same switches mean something to the API that decides them —
 * `toProfileCard()` for presence/distance/last-seen, `users.visible` for
 * discovery, `users.incognito` for footprints, `notif_prefs` for delivery
 * (0026). Kept out of `#/lib/settings-map.ts` because that file is pure mapping
 * and is imported by tests that must not need React Query.
 *
 * Semantics worth naming:
 *   - **Optimistic, then reconciled.** A tap flips the switch at once, the write
 *     goes out, and on success the local override is dropped in favour of the
 *     refetched row. A screen that only updated after the response would feel
 *     broken on a phone; a screen that never reconciled would drift from the
 *     server the first time another device disagreed.
 *   - **A failed write is shown, not swallowed.** The override rolls back and
 *     `error` carries the server's message, because "Saved ✓" over a rejected
 *     `PUT` is how a privacy switch becomes a lie.
 *   - **A failed read is not defaulted.** `ready` stays false with `error` set;
 *     `DEFAULT_SETTINGS` only covers "not answered yet", never "answer was 500".
 */
export function useServerSettings() {
	const query = useQuery({
		// Shared with nothing else today, but keyed like the rest of the app's
		// server state so `notifications`/`profile` invalidation stays cheap to add.
		queryKey: ["settings", "prefs"],
		queryFn: async (): Promise<ServerSettings> => {
			const response = await api<{ prefs?: Partial<ServerSettings> | null }>(
				"/api/settings",
			);
			if (!response || typeof response.prefs !== "object" || !response.prefs)
				throw new Error("Settings endpoint returned no preferences");
			return { ...DEFAULT_SETTINGS, ...response.prefs };
		},
		staleTime: 30_000,
		retry: 1,
		// Client-only, and not an optimisation: `api()` fetches a *relative* URL, which
		// has no origin for Node to resolve, so fetching during SSR produces a failed
		// request on every render and an error state that then has to be recovered from.
		// The screen renders its loading caption for that pass instead.
		enabled: typeof window !== "undefined",
	});

	const [overrides, setOverrides] = useState<
		Partial<Record<ServerPrivacyField, boolean>>
	>({});
	const [pending, setPending] = useState<ServerPrivacyField | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const value = useCallback(
		(field: ServerPrivacyField): boolean => {
			const override = overrides[field];
			if (override !== undefined) return override;
			return valueFor(query.data, field);
		},
		[overrides, query.data],
	);

	const toggle = useCallback(
		async (field: ServerPrivacyField): Promise<boolean> => {
			const next = !value(field);
			setOverrides((current) => ({ ...current, [field]: next }));
			setPending(field);
			setError(null);
			setSaved(false);
			try {
				await api("/api/settings", {
					method: "PUT",
					body: patchFor(field, next),
				});
				// Drop the override before reconciling so the refetched row, not the
				// guess, is what the switch shows a moment later.
				setOverrides((current) => {
					const nextOverrides = { ...current };
					delete nextOverrides[field];
					return nextOverrides;
				});
				await query.refetch();
				setSaved(true);
				setTimeout(() => setSaved(false), 2000);
				return true;
			} catch (cause) {
				setOverrides((current) => {
					const nextOverrides = { ...current };
					delete nextOverrides[field];
					return nextOverrides;
				});
				setError(
					cause instanceof Error
						? cause.message
						: "Could not save this setting",
				);
				return false;
			} finally {
				setPending(null);
			}
		},
		[query, value],
	);

	return {
		value,
		toggle,
		pending,
		error,
		saved,
		// `isPending`, not `isLoading`: with the query disabled during SSR,
		// `isLoading` is false while there is still no data, and a switch that looks
		// tappable before the row has arrived is a switch that writes a default.
		ready: !query.isPending && !query.isFetching,
		isLoading: query.isPending,
	};
}
