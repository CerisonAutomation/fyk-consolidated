"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Bell,
	CalendarDays,
	CheckCheck,
	Crown,
	Eye,
	MessageCircle,
	PawPrint,
	Sparkles,
	Trash2,
	Zap,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import { Avatar } from "#/components/ui/Avatar";
import { PushRow } from "#/components/notifications/push-row";
import { setUnreadBadge } from "#/lib/badge";
import { onPushMessage, restorePush, syncPushSubscription } from "#/lib/push";
import { registerServiceWorker } from "#/lib/persist";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { Notification } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

const ICONS: Record<string, { icon: typeof Bell; color: string }> = {
	match: { icon: Crown, color: "text-gold" },
	tap: { icon: Zap, color: "text-gold-soft" },
	message: { icon: MessageCircle, color: "text-blue-400" },
	view: { icon: Eye, color: "text-purple-400" },
	like: { icon: Eye, color: "text-rose-400" },
	event: { icon: CalendarDays, color: "text-emerald-400" },
	ai: { icon: Sparkles, color: "text-gold" },
	pet: { icon: PawPrint, color: "text-amber-400" },
	meetnow: { icon: Zap, color: "text-amber-400" },
	system: { icon: Bell, color: "text-muted" },
};

/**
 * Notification deep links come from the database, so they must be constrained
 * to same-origin, app-relative paths before they reach an <a href>. This blocks
 * `javascript:`/`http://evil` and protocol-relative `//host` values.
 */
/**
 * A scheme, in anything that claims to be a path. Exported as a named constant so
 * `public/sw.js` can carry the *same literal text* and `src/lib/app-shell.test.ts` can
 * require the two to stay identical: the notification tap path is a second, uncompiled
 * consumer of the same untrusted `href` column, and two hand-copied filters drift.
 */
export const UNSAFE_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function safeDeepLink(value: string | null | undefined): string | null {
	if (!value) return null;
	if (!value.startsWith("/") || value.startsWith("//")) return null;
	if (UNSAFE_SCHEME.test(value)) return null;
	return value;
}

/**
 * Nothing happens on mount except reads. Permission is only ever requested from the
 * `PushRow` button (`#/lib/push` explains why that distinction is not cosmetic), and the
 * service worker is registered here — rather than inside `PushRow` — because the offline
 * shell and the app badge need it too, so it must exist even for a user who never touches
 * the notifications screen.
 */
async function prepareDevice(): Promise<void> {
	await registerServiceWorker();
	await syncPushSubscription();
}

export function NotificationsClient() {
	const qc = useQueryClient();
	const pushToast = useAppStore((s) => s.pushToast);

	useEffect(() => {
		void prepareDevice();
	}, []);

	/**
	 * The service worker cannot route, refetch or re-subscribe by itself (no document, no
	 * providers), so it posts these three things and this is where they land:
	 * `fyk:navigate` from a notification click, `fyk:inbox-dirty` when a push arrived or was
	 * dismissed while the app was open, and `fyk:push-resync` after the browser dropped the
	 * subscription. Navigating with `location.assign` rather than the router is deliberate —
	 * it works while the route tree is still hydrating, which is exactly when a user taps a
	 * notification.
	 */
	useEffect(() => {
		return onPushMessage((message) => {
			if (message.type === "fyk:inbox-dirty") {
				qc.invalidateQueries({ queryKey: ["notifications"] });
				return;
			}
			if (message.type === "fyk:push-resync") {
				// Re-subscribe (no prompt: permission is already granted), and if the
				// browser will not, at least re-POST whatever it does hold.
				void restorePush().then(() => syncPushSubscription());
				return;
			}
			if (window.location.pathname + window.location.search !== message.href) {
				window.location.assign(message.href);
			} else {
				qc.invalidateQueries({ queryKey: ["notifications"] });
			}
		});
	}, [qc]);

	const { data, isLoading } = useQuery({
		queryKey: ["notifications"],
		queryFn: () =>
			api<{ notifications: Notification[]; unread: number }>(
				"/api/notifications",
			),
	});

	const act = useMutation({
		mutationFn: (action: string) =>
			api("/api/notifications", { method: "POST", body: { action } }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["notifications"] });
		},
	});

	/** Mark a single notification as read when clicked. */
	const markRead = useCallback(
		(notificationId: string) => {
			api("/api/notifications", {
				method: "POST",
				body: { action: "markRead", notificationId },
			})
				.then(() => {
					qc.invalidateQueries({ queryKey: ["notifications"] });
				})
				.catch(() => {
					// Non-critical: notification stays unread
				});
		},
		[qc],
	);

	const items = data?.notifications ?? [];
	const unread = data?.unread ?? 0;

	// The home-screen badge is derived from the same number the "N new" chip above uses, so
	// the two can never disagree while this screen is open. `#/lib/badge` is a no-op where
	// the platform has no badging API.
	useEffect(() => {
		if (isLoading) return;
		void setUnreadBadge(unread);
	}, [unread, isLoading]);

	const groups = items.reduce<Record<string, Notification[]>>((acc, n) => {
		const bucket = !n.read
			? "New"
			: timeAgo(n.created_at).includes("h ago")
				? "Earlier today"
				: "Older";
		(acc[bucket] ??= []).push(n);
		return acc;
	}, {});

	return (
		<div className="mx-auto max-w-2xl">
			<div className="mb-2 flex items-center gap-2">
				<Bell className="h-5 w-5 text-gold" />
				<h1 className="text-xl font-bold text-white">Activity</h1>
				{unread > 0 && (
					<span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-soft">
						{unread} new
					</span>
				)}
			</div>
			<p className="mb-4 text-sm text-muted">
				Taps, matches, views and AI suggestions — all in one place.
			</p>

			<PushRow />

			{items.length > 0 && (
				<div className="mb-4 flex gap-2">
					<Button
						variant="secondary"
						size="sm"
						onClick={() => act.mutate("markAllRead")}
					>
						<CheckCheck className="h-3.5 w-3.5" /> Mark all read
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							act.mutate("clear");
							pushToast("Activity cleared", "info");
						}}
					>
						<Trash2 className="h-3.5 w-3.5" /> Clear
					</Button>
				</div>
			)}

			{isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-20 rounded-2xl" />
					))}
				</div>
			) : items.length === 0 ? (
				<EmptyState
					icon="🔔"
					title="No activity yet"
					description="As you tap, match and chat, everything shows up here."
				/>
			) : (
				<div className="space-y-5">
					{Object.entries(groups).map(([label, list]) => (
						<div key={label}>
							<p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted/70">
								{label}
							</p>
							<div className="space-y-2">
								{list.map((n) => {
									const meta = ICONS[n.type] ?? ICONS.system;
									const Icon = meta.icon;
									const body = (
										<div
											className={cn(
												"flex items-start gap-3 rounded-2xl border p-3 transition-colors",
												n.read
													? "border-line bg-surface/60"
													: "border-gold/25 bg-gold/[0.06]",
											)}
										>
											{n.actor ? (
												<Avatar
													name={n.actor.pseudo}
													photoUrl={n.actor.photos?.[0]}
													size={42}
													online={n.actor.online}
												/>
											) : (
												<div
													className={cn(
														"flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-white/5",
														meta.color,
													)}
												>
													<Icon className="h-5 w-5" />
												</div>
											)}
											<div className="min-w-0 flex-1">
												<div className="flex items-start justify-between gap-2">
													<p className="text-sm font-medium leading-snug text-white">
														{n.title}
													</p>
													<span className="shrink-0 text-[11px] text-muted">
														{timeAgo(n.created_at)}
													</span>
												</div>
												{n.body && (
													<p className="mt-0.5 text-xs leading-relaxed text-muted">
														{n.body}
													</p>
												)}
												{n.actor && (
													<p className="mt-1 text-[11px] text-gold/70">
														{n.actor.tribes.join(" · ") || n.actor.geo?.city}
													</p>
												)}
											</div>
										</div>
									);

									// Wrap in a click handler that marks as read
									const handleClick = () => {
										if (!n.read) {
											markRead(n.id);
										}
									};

									const deepLink = safeDeepLink(n.href);
									return deepLink ? (
										<a
											key={n.id}
											href={deepLink}
											className="block"
											onClick={handleClick}
										>
											{body}
										</a>
									) : (
										<div
											key={n.id}
											onClick={handleClick}
											className="cursor-pointer"
										>
											{body}
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
