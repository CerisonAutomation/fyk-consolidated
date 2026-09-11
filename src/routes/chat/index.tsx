import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "#/lib/client";
import type { ConversationRow } from "#/lib/api-types";
import { timeAgo } from "#/lib/utils";
import { Avatar } from "#/components/ui/Avatar";
import { StateBlock, describeFailure } from "#/components/ui/StateBlock";
import { PullToRefresh } from "#/components/ui/PullToRefresh";
import { useShell } from "#/components/AppShell";

export const Route = createFileRoute("/chat/")({
	component: ChatListPage,
	head: () => ({ meta: [{ title: "Chats — FYK" }] }),
});

function ChatListPage() {
	const { capable } = useShell();
	const navigate = useNavigate();
	const [term, setTerm] = useState("");

	const { data, isPending, error, refetch, isFetching } = useQuery({
		queryKey: ["conversations"],
		queryFn: () => api.get<{ conversations: ConversationRow[] }>("conversations"),
		enabled: capable("chat"),
		// Polling, not a socket: claiming realtime here would be a false claim. The
		// interval is only active while the tab is visible.
		refetchInterval: 12_000,
		refetchIntervalInBackground: false,
	});

	const conversations = useMemo(() => {
		const all = data?.conversations ?? [];
		const needle = term.trim().toLowerCase();
		if (!needle) return all;
		return all.filter((row) => (row.other?.displayName ?? "").toLowerCase().includes(needle) || row.preview.toLowerCase().includes(needle));
	}, [data, term]);

	if (!capable("chat")) {
		return <StateBlock kind="disabled" title="Chats are unavailable" description="conversations and messages are not readable for your account. Apply the migrations in supabase/migrations and reload." />;
	}

	const failure = error ? describeFailure(error) : null;

	return (
		<PullToRefresh onRefresh={async () => { await refetch(); }}>
			<div className="mb-3 flex items-center gap-2">
				<label className="relative flex-1">
					<span className="sr-only">Search conversations</span>
					<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
					<input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search chats" className="entry-input h-11 pl-10 text-[13.5px]" />
				</label>
				<button type="button" onClick={() => void refetch()} className="press flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-2" aria-label="Refresh chats">
					<RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
				</button>
			</div>

			{isPending ? (
				<ul className="space-y-2" aria-hidden="true">
					{[0, 1, 2, 3, 4].map((index) => (
						<li key={index} className="skeleton h-[68px] rounded-2xl" />
					))}
				</ul>
			) : failure ? (
				<StateBlock kind="error" title="Your chats could not load" description={failure.message} action={<button type="button" onClick={() => void refetch()} className="press h-11 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black">Try again</button>} />
			) : conversations.length === 0 ? (
				<StateBlock
					kind="empty"
					title={term ? "No chat matches that search" : "No conversations yet"}
					description={term ? "Try a different name." : "A chat opens when you and someone else tap each other. Nothing here is simulated: no bot will message you first."}
					action={
						<button type="button" onClick={() => void navigate({ to: "/grid" })} className="press flex h-11 items-center gap-2 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black">
							<MessageCircle className="h-4 w-4" /> Find someone nearby
						</button>
					}
				/>
			) : (
				<ul className="space-y-1.5">
					{conversations.map((row) => (
						<li key={row.id}>
							<button
								type="button"
								onClick={() => void navigate({ to: "/chat/$conversationId", params: { conversationId: row.id } })}
								className="press flex w-full items-center gap-3 rounded-2xl border border-transparent bg-surface px-3 py-3 text-left transition-colors hover:border-line"
							>
								<span className="relative shrink-0">
									<Avatar name={row.other?.displayName ?? "Former member"} photoUrl={row.other?.avatarUrl ?? null} size={46} online={row.other?.presence === "online"} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex items-baseline gap-2">
										<span className={row.unread > 0 ? "truncate text-[14.5px] font-bold text-ink" : "truncate text-[14.5px] font-semibold text-ink-2"}>
											{row.other?.displayName ?? "Former member"}
										</span>
										<span className="ml-auto shrink-0 text-[11px] text-faint">{row.lastMessageAt ? timeAgo(row.lastMessageAt) : ""}</span>
									</span>
									<span className="mt-0.5 flex items-center gap-2">
										<span className={row.unread > 0 ? "truncate text-[13px] text-ink-2" : "truncate text-[13px] text-muted"}>{row.preview}</span>
										{row.unread > 0 ? <span className="ml-auto shrink-0 rounded-full bg-gold px-1.5 text-[10.5px] font-bold leading-4 text-black">{row.unread}</span> : null}
									</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</PullToRefresh>
	);
}
