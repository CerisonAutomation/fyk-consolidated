import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/client";
import { SCREEN_SOURCES, type ScreenAction, type ScreenKey } from "@/lib/screen-sources";

/**
 * The write behind a generated list screen's card button.
 *
 * Every one of those buttons posted to `/api/<screen>/{id}/action` — a path nobody
 * serves — and then invalidated the list, so the screen re-rendered looking as
 * though the action had landed. This sends the body the real route's schema
 * accepts, to the real route, with the token attached, and hands the refusal back as
 * a sentence: "Event full", "Already joined", "Max 10 saved searches".
 */

export interface UseScreenActionOptions {
	/** Query keys to invalidate after a successful write. */
	invalidate?: unknown[];
	onDone?: (result: unknown) => void;
	onRefused?: (message: string) => void;
}

export type ScreenActionSlot = "primary" | "secondary" | "header";

/** The action a screen's button performs, or `null` when it has none. */
export function screenActionOf(
	key: ScreenKey,
	which: ScreenActionSlot = "primary",
): ScreenAction | null {
	const source = SCREEN_SOURCES[key];
	if (which === "primary") return source.action;
	if (which === "secondary") return source.secondary ?? null;
	return source.headerAction ?? null;
}

/** The label for that button, or `null` when the button should not render. */
export function screenActionLabel(
	key: ScreenKey,
	which: ScreenActionSlot = "primary",
): string | null {
	return screenActionOf(key, which)?.label ?? null;
}

export function useScreenAction(
	key: ScreenKey,
	which: ScreenActionSlot = "primary",
	options: UseScreenActionOptions = {},
) {
	const qc = useQueryClient();
	const { invalidate, onDone, onRefused } = options;

	return useMutation({
		mutationFn: async (item: { id: string; name?: string }) => {
			const action = screenActionOf(key, which);
			if (!action)
				throw new ApiError(0, `${SCREEN_SOURCES[key].title} has no such action`);
			return api<Record<string, unknown>>(action.url(item), {
				method: action.method ?? "POST",
				body: action.body?.(item),
			});
		},
		// A header action is handed the screen's own id, so an empty one is a bug in
		// the screen rather than a request the server should have to interpret.
		onMutate: (item) => {
			if (!item.id) throw new ApiError(0, "That action needs an id this screen does not have");
		},
		onSuccess: (result) => {
			if (invalidate) qc.invalidateQueries({ queryKey: invalidate });
			onDone?.(result);
		},
		onError: (error) => {
			onRefused?.(
				error instanceof ApiError || error instanceof Error
					? error.message
					: "That did not go through. Try again.",
			);
		},
	});
}
