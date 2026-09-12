import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BellOff, Check, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { PullToRefresh } from "#/components/ui/PullToRefresh";
import { describeFailure, StateBlock } from "#/components/ui/StateBlock";
import type { NotificationRow } from "#/lib/api-types";
import { api } from "#/lib/client";
import { useToasts } from "#/lib/toast";
import { cn, timeAgo } from "#/lib/utils";

export const Route = createFileRoute("/notifications/")({
	component: NotificationsPage,
	head: () => ({ meta: [{ title: "Activity — FYK" }] }),
});

/**
 * Only routes this app really has are followable. A deep link the router cannot
 * resolve would render as a button that does nothing, so an unknown link is shown
 * as plain text with "link unavailable" instead.
 */
function openDeepLink(link: string, navigate: ReturnType<typeof useNavigate>) {
	const chat =
		/^\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
			link,
		);
	if (chat)
		return navigate({
			to: "/chat/$conversationId",
			params: { conversationId: chat[1] },
		});
	const profile =
		/^\/profile\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
			link,
		);
	if (profile)
		return navigate({
			to: "/profile/$profileId",
			params: { profileId: profile[1] },
		});
	if (link === "/board") return navigate({ to: "/board" });
	if (link === "/events") return navigate({ to: "/events" });
	if (link === "/grid") return navigate({ to: "/grid" });
	return undefined;
}

function NotificationsPage() {
	const queryClient = useQueryClient();
	const push = useToasts((state) => state.push);
	const navigate = useNavigate();

	const { data, isPending, error, refetch, isFetching } = useQuery({
		queryKey: ["notifications"],
		queryFn: () =>
			api.get<{ notifications: NotificationRow[]; unread: number }>(
				"notifications",
			),
		staleTime: 20_000,
	});

	const mark = useMutation({
		mutationFn: (body: { action: "read" | "readAll"; id?: string }) =>
			api.post<{ ok: boolean }>("notifications", body),
		onSuccess: () =>
			void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
		onError: (err) =>
			push(err instanceof Error ? err.message : "That did not save.", "error"),
	});

	const failure = error ? describeFailure(error) : null;
	const items = data?.notifications ?? [];
	const unread = data?.unread ?? 0;

	return (
		<div className="mx-auto max-w-xl">
			<header className="mb-3 flex items-center gap-2">
				<h1 className="text-[18px] font-bold tracking-[-0.02em]">Activity</h1>
				{unread > 0 ? (
					<span className="rounded-full bg-gold px-1.5 text-[11px] font-bold leading-5 text-black">
						{unread}
					</span>
				) : null}
				<div className="ml-auto flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => void refetch()}
						className="press grid h-9 w-9 place-items-center rounded-full border border-line text-muted"
						aria-label="Refresh activity"
					>
						<RefreshCw
							className={cn("h-4 w-4", isFetching && "animate-spin")}
						/>
					</button>
					{unread > 0 && (
						<button
							type="button"
							disabled={mark.isPending}
							onClick={() => mark.mutate({ action: "readAll" })}
							className="press flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12.5px] font-semibold text-ink-2"
						>
							{mark.isPending ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Check className="h-3.5 w-3.5" />
							)}{" "}
							Mark all read
						</button>
					)}
				</div>
			</header>

			<p className="mb-4 text-[12.5px] leading-relaxed text-muted">
				This list is refreshed while you have FYK open. There is no push
				notification and no email — if a control for either existed, it would be
				here and it would work.
			</p>

			<PullToRefresh
				onRefresh={async () => {
					await refetch();
				}}
			>
				{isPending ? (
					<ul className="space-y-2" aria-hidden="true">
						{[0, 1, 2].map((index) => (
							<li key={index} className="skeleton h-16 rounded-2xl" />
						))}
					</ul>
				) : failure ? (
					<StateBlock
						kind="error"
						title="Activity could not load"
						description={failure.message}
						action={
							<button
								type="button"
								onClick={() => void refetch()}
								className="press h-11 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black"
							>
								Try again
							</button>
						}
					/>
				) : items.length === 0 ? (
					<StateBlock
						kind="empty"
						title="Nothing yet"
						description="Matches, Board replies and event updates land here. A notification is written by the server in the same transaction as the event that caused it, so nothing here is invented."
					/>
				) : (
					<ul className="space-y-1.5">
						{items.map((item) => {
							const link = item.deepLink ?? null;
							return (
								<li key={item.id}>
									<button
										type="button"
										onClick={() => {
											if (!item.read)
												mark.mutate({ action: "read", id: item.id });
											if (link) void openDeepLink(link, navigate);
										}}
										disabled={!link || !isFollowable(link)}
										className={cn(
											"press flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
											item.read
												? "border-line bg-surface"
												: "border-gold/30 bg-gold-ghost",
											!link && "cursor-default opacity-90",
										)}
									>
										<span
											className={cn(
												"mt-1.5 h-2 w-2 shrink-0 rounded-full",
												item.read ? "bg-white/20" : "bg-gold",
											)}
											aria-hidden="true"
										/>
										<span className="min-w-0 flex-1">
											<span className="flex items-baseline gap-2">
												<span className="truncate text-[13.5px] font-semibold text-ink">
													{item.title}
												</span>
												<span className="ml-auto shrink-0 text-[11px] text-faint">
													{timeAgo(item.createdAt)}
												</span>
											</span>
											{item.body ? (
												<span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">
													{item.body}
												</span>
											) : null}
											<span className="mt-1 block text-[11px] font-medium text-faint">
												{kindLabel(item.kind)}
												{link
													? " · opens in app"
													: item.deepLink
														? " · link unavailable"
														: ""}
											</span>
										</span>
										{link ? (
											<ExternalLink
												className="mt-1 h-3.5 w-3.5 shrink-0 text-faint"
												aria-hidden="true"
											/>
										) : null}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</PullToRefresh>

			{items.length === 0 && (
				<p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-faint">
					<BellOff className="h-3.5 w-3.5" /> Nothing is waiting for you
				</p>
			)}
		</div>
	);
}

function isFollowable(link: string): boolean {
	return (
		/^\/chat\/[0-9a-f-]{36}$/i.test(link) ||
		/^\/profile\/[0-9a-f-]{36}$/i.test(link) ||
		["/board", "/events", "/grid"].includes(link)
	);
}

function kindLabel(kind: string) {
	if (kind === "match") return "Match";
	if (kind === "message") return "Message";
	if (kind === "event") return "Event";
	if (kind === "board") return "Board";
	if (kind === "safety") return "Safety";
	return "FYK";
}
