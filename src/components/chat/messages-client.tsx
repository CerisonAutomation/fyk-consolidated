"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { MessageCircle, Search, Sparkles, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "#/components/ui/Avatar";
import { ChatView } from "@/components/chat/chat-view";
import {
	Badge,
	Button,
	EmptyState,
	Skeleton,
} from "@/components/ui/primitives";
import { api } from "@/lib/client";
import type { ConversationWithMeta } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

type Digest = {
	bullets: string[];
	actionItems: string[];
};

export function MessagesClient() {
	const params = useSearch({ strict: false }) as Record<string, string>;
	const [activeId, setActiveId] = useState<string | null>(params.c ?? null);
	const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
	const [search, setSearch] = useState("");
	const [digest, setDigest] = useState<Digest | null>(null);
	const [digestLoading, setDigestLoading] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: ["conversations"],
		queryFn: () =>
			api<{ conversations: ConversationWithMeta[] }>("/api/conversations").then(
				(r) => r.conversations,
			),
		refetchInterval: 15000,
	});

	// deep-link support
	useEffect(() => {
		const c = params.c;
		if (c) setActiveId(c);
	}, [params]);

	const conversations = data ?? [];
	const unreadTotal = conversations.reduce((s, c) => s + c.unread, 0);

	async function loadDigest() {
		if (conversations.length === 0) return;
		setDigestLoading(true);
		try {
			// digest the most recent conversation with messages
			const withMsgs = conversations.filter((c) => c.lastMessage);
			if (withMsgs.length === 0) {
				setDigest({
					bullets: ["No conversations to summarise"],
					actionItems: [],
				});
				return;
			}
			const r = await api<Digest>("/api/ai", {
				method: "POST",
				body: { action: "summary", conversationId: withMsgs[0].id },
			});
			setDigest(r);
		} catch {
			setDigest({
				bullets: ["AI digest unavailable right now"],
				actionItems: [],
			});
		} finally {
			setDigestLoading(false);
		}
	}

	if (activeId) {
		return (
			<ChatView conversationId={activeId} onBack={() => setActiveId(null)} />
		);
	}

	const filtered = conversations.filter((c) => {
		if (filter === "unread" && c.unread === 0) return false;
		if (filter === "groups" && c.type !== "group") return false;
		if (search.trim()) {
			const n = search.toLowerCase();
			if (c.type === "group") {
				if (!(c.name ?? "").toLowerCase().includes(n)) return false;
			} else if (!c.otherUser?.pseudo.toLowerCase().includes(n)) return false;
		}
		return true;
	});

	return (
		<div>
			<div className="mb-2 flex items-center gap-2">
				<MessageCircle className="h-5 w-5 text-gold" />
				<h1 className="text-xl font-bold text-white">Messages</h1>
				{unreadTotal > 0 && <Badge color="gold">{unreadTotal} unread</Badge>}
			</div>
			<p className="mb-4 text-sm text-muted">
				Your conversations, ranked by recency. AI helps you never lose a good
				one.
			</p>

			{/* AI digest */}
			<div className="mb-4 rounded-2xl border border-gold/20 bg-gold/[0.05] p-3">
				<div className="mb-2 flex items-center gap-2">
					<Sparkles className="h-4 w-4 text-gold" />
					<h2 className="text-xs font-semibold text-gold-soft">
						AI conversation digest
					</h2>
					<button
						onClick={loadDigest}
						disabled={digestLoading || conversations.length === 0}
						className="ml-auto text-[11px] text-gold hover:text-gold-soft disabled:opacity-50"
					>
						{digest ? "Refresh" : digestLoading ? "Thinking…" : "Summarise"}
					</button>
				</div>
				{digestLoading ? (
					<div className="space-y-1.5">
						<div className="skeleton h-3 w-4/5 rounded" />
						<div className="skeleton h-3 w-3/5 rounded" />
					</div>
				) : digest ? (
					<div className="space-y-2">
						{digest.bullets.map((b, i) => (
							<p
								key={i}
								className="flex items-start gap-1.5 text-xs text-white/85"
							>
								<span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gold" />{" "}
								{b}
							</p>
						))}
						{digest.actionItems.length > 0 && (
							<div className="mt-2 space-y-1 border-t border-gold/15 pt-2">
								{digest.actionItems.map((a, i) => (
									<p
										key={i}
										className="flex items-start gap-1.5 text-xs font-medium text-gold-soft"
									>
										<Zap className="mt-0.5 h-3 w-3 shrink-0" /> {a}
									</p>
								))}
							</div>
						)}
					</div>
				) : (
					<p className="text-xs text-muted">
						Get an instant summary of where things stand and what to do next.
					</p>
				)}
			</div>

			{/* search + filters */}
			<div className="mb-4 space-y-2">
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search conversations…"
						className="w-full rounded-xl border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
					/>
				</div>
				<div className="flex gap-1.5">
					{(
						[
							["all", `All (${conversations.length})`],
							["unread", `Unread (${unreadTotal})`],
							[
								"groups",
								`Groups (${conversations.filter((c) => c.type === "group").length})`,
							],
						] as const
					).map(([k, label]) => (
						<button
							key={k}
							onClick={() => setFilter(k)}
							className={cn(
								"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
								filter === k
									? "border-gold/50 bg-gold/15 text-gold-soft"
									: "border-line bg-surface text-muted hover:text-white",
							)}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							key={i}
							className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
						>
							<Skeleton className="h-12 w-12 rounded-full" />
							<div className="flex-1">
								<Skeleton className="mb-2 h-4 w-32" />
								<Skeleton className="h-3 w-48" />
							</div>
						</div>
					))}
				</div>
			) : filtered.length === 0 ? (
				<EmptyState
					icon="💬"
					title={
						search.trim() ? "No matching conversations" : "No conversations yet"
					}
					description={
						search.trim()
							? "Try a different search."
							: "Tap some kings from Discover to start chatting."
					}
					action={
						!search.trim() ? (
							<Button onClick={() => (window.location.href = "/discover")}>
								Go discover
							</Button>
						) : undefined
					}
				/>
			) : (
				<div className="space-y-2">
					{filtered.map((c) => {
						const isGroup = c.type === "group";
						const label = isGroup
							? (c.name ?? "Group")
							: (c.otherUser?.pseudo ?? "User");
						return (
							<button
								key={c.id}
								onClick={() => setActiveId(c.id)}
								className={cn(
									"flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-gold/30 hover:bg-surface-2",
									c.unread > 0
										? "border-gold/25 bg-gold/[0.05]"
										: "border-line bg-surface",
								)}
							>
								<div className="relative shrink-0">
									{isGroup ? (
										<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-lg">
											{c.avatar ?? <Users className="h-5 w-5 text-gold" />}
										</div>
									) : (
										<Avatar
											name={c.otherUser?.pseudo ?? ""}
											photoUrl={c.otherUser?.photos?.[0]}
											size={48}
											online={c.otherUser?.online}
										/>
									)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-1.5">
										<span className="truncate text-sm font-semibold text-white">
											{label}
										</span>
										{isGroup && (
											<Users className="h-3 w-3 shrink-0 text-muted" />
										)}
										{c.muted && (
											<span className="text-[10px] text-muted">🔇</span>
										)}
										{c.lastMessage && (
											<span className="ml-auto shrink-0 text-[11px] text-muted">
												{timeAgo(c.lastMessage.created_at)}
											</span>
										)}
									</div>
									<p
										className={cn(
											"truncate text-sm",
											c.unread > 0 ? "font-medium text-white" : "text-muted",
										)}
									>
										{c.lastMessage
											? `${c.lastMessage.sender_id === c.otherUser?.id || isGroup ? "" : "You: "}${c.lastMessage.content?.slice(0, 50) ?? ""}`
											: "Say hi 👋"}
									</p>
									{!isGroup && (
										<p className="truncate text-[11px] text-muted">
											{c.otherUser?.online ? (
												<span className="text-emerald-400">● Online now</span>
											) : (
												`Active ${timeAgo(c.otherUser?.lastSeen ?? c.otherUser?.createdAt ?? "")}`
											)}
										</p>
									)}
								</div>
								{c.unread > 0 && (
									<span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-bold text-ink">
										{c.unread}
									</span>
								)}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
