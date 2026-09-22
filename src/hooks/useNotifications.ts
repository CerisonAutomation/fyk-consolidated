import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "@/lib/client";

/**
 * The notification list and marking one read.
 *
 * The read call went to `POST /api/notifications/{id}/read`, which does not exist:
 * the mutation resolved (a 404 is still a response), `onSuccess` invalidated the
 * list, the list came back with the same unread row, and the badge never moved.
 * `#/routes/api/notifications` answers `markRead` on the collection with the id in
 * the body, and refuses an id that is not the caller's with a 404 — so a failure is
 * now thrown rather than mistaken for success.
 *
 * Reads go through `api()` for the same reason every other call in this repo does:
 * the route is `auth: "required"`, and a cookie-only fetch reaches it anonymous.
 */

export interface NotificationRow {
	id: string;
	type: string;
	title: string;
	body?: string | null;
	read: boolean;
	createdAt?: string;
	[key: string]: unknown;
}

export function useNotifications() {
	const qc = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["notifications"],
		queryFn: () =>
			api<{ notifications: NotificationRow[]; unread: number }>(
				"/api/notifications",
			),
	});

	const markRead = useMutation({
		mutationFn: (id: string) =>
			post<{ ok: boolean }>("/api/notifications", {
				action: "markRead",
				notificationId: id,
			}),
		// Both the list and any unread badge derived from it.
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
	});

	const markAllRead = useMutation({
		mutationFn: () =>
			post<{ ok: boolean; updated?: number }>("/api/notifications", {
				action: "markAllRead",
			}),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
	});

	return {
		notifications: data?.notifications ?? [],
		unread: data?.unread ?? 0,
		isLoading,
		markRead: markRead.mutate,
		markAllRead: markAllRead.mutate,
		/** The refusal, so a badge that did not move can say why. */
		error: markRead.error ?? null,
	};
}
