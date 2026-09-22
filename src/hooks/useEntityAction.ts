import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, post } from "@/lib/client";
import {
	type EntityActionKind,
	type EntityDomain,
	type EntityRef,
	entityRequest,
} from "@/lib/entity-actions";

/**
 * The two buttons on a generated list card, wired to routes that exist.
 *
 * WHAT IT REPLACED
 * ----------------
 * Each client inlined its own `useMutation` around a raw `fetch` to a path nobody
 * serves, with `credentials: "include"` and no bearer token — so even a correct
 * path would have answered 401 to a signed-in user, and the failure surfaced as
 * `Error("Boost failed")`, a sentence that tells the caller nothing about a 402
 * (wallet cannot cover it), a 409 (already promoted / already subscribed) or a 503
 * (no payment provider configured).
 *
 * This hook owns the four things all ten screens needed and none had:
 *   - the canonical route and exact payload, from `#/lib/entity-actions`;
 *   - the token, by going through `#/lib/client#post`, which also refreshes the
 *     session on 401 and rethrows the server's own sentence;
 *   - cache invalidation, so a successful write is visible as a reordered list
 *     instead of a button that appears to do nothing;
 *   - the refusal, handed to `onRefused` as a readable message — a 409 "already
 *     promoted until …" is an answer, not a crash.
 */

export interface UseEntityActionOptions {
	/** Query keys to invalidate after a successful write. */
	invalidate?: unknown[];
	/** Haptics and any other success side effect stay in the component. */
	onDone?: (result: unknown) => void;
	/** Called with the server's sentence when the write is refused. */
	onRefused?: (message: string) => void;
}

export function useEntityAction(
	domain: EntityDomain,
	kind: EntityActionKind,
	options: UseEntityActionOptions = {},
) {
	const qc = useQueryClient();
	const { invalidate, onDone, onRefused } = options;

	return useMutation({
		mutationFn: async (ref: EntityRef) => {
			const request = entityRequest(domain, kind, ref);
			// A domain with no such action has no button (the component hides it);
			// reaching here means the mapping and the JSX disagreeed.
			if (!request)
				throw new ApiError(0, `There is no ${kind} action for ${domain}`);
			return post<Record<string, unknown>>(request.url, request.body);
		},
		onSuccess: (result) => {
			if (invalidate) qc.invalidateQueries({ queryKey: invalidate });
			onDone?.(result);
		},
		onError: (error) => {
			onRefused?.(refusalMessage(error));
		},
	});
}

/** The sentence to show a person when a write is refused. */
export function refusalMessage(error: unknown): string {
	if (error instanceof ApiError) return error.message;
	if (error instanceof Error && error.message) return error.message;
	return "That did not go through. Try again.";
}
