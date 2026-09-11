import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Pin, Star, VolumeX, PenSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useConversations } from "#/core/api/hooks/use-conversations";
import { ChatListSkeleton, EmptyState } from "#/core/ui/fyk-primitives";
import { type Conversation, useConversationsStore } from "#/domains/chat/store";
import { cn } from "#/utils/cn";

export const Route = createFileRoute("/chat/")({
	component: ChatListPage,
});

/* ================================================================== */
/*  FYK Premium Chat List                                              */
/* ================================================================== */

type TabId = "all" | "unread" | "matches" | "groups";

const TABS: { id: TabId; label: string; count?: number }[] = [
 { id: "all", label: "All" },
 { id: "unread", label: "Unread" },
 { id: "matches", label: "Matches" },
 { id: "groups", label: "Groups" },
];

function ChatListPage() {
	const { entries, loading, error, setEntries, setLoading, setError } =
		useConversationsStore();
	const conversations = useConversations();
	const [activeTab, setActiveTab] = useState<TabId>("all");

	useEffect(() => {
		setLoading(conversations.isLoading);
		setError(conversations.error ?? null);
		if (conversations.data) {
			setEntries(
				conversations.data.entries.flatMap((entry) => {
					const conversation = toConversation(entry);
					return conversation ? [conversation] : [];
				}),
			);
		}
	}, [
		conversations.data,
		conversations.error,
		conversations.isLoading,
		setEntries,
		setError,
		setLoading,
	]);

	const sortedEntries = useMemo(() => {
		return [...entries].sort((a, b) => {
			// Pinned first
			if (a.data.pinned && !b.data.pinned) return -1;
			if (!a.data.pinned && b.data.pinned) return 1;
			// Unread first
			if (a.data.unreadCount > 0 && b.data.unreadCount === 0) return -1;
			if (a.data.unreadCount === 0 && b.data.unreadCount > 0) return 1;
			return 0;
		});
	}, [entries]);

	const filteredEntries = useMemo(() => {
		if (activeTab === "unread") return sortedEntries.filter((e) => e.data.unreadCount > 0);
		if (activeTab === "matches") return sortedEntries.filter((e) => e.type === "match");
		if (activeTab === "groups") return sortedEntries.filter((e) => e.type === "group");
		return sortedEntries;
	}, [sortedEntries, activeTab]);

	const unreadCount = useMemo(() => entries.filter((e) => e.data.unreadCount > 0).length, [entries]);
	const matchesCount = useMemo(() => entries.filter((e) => e.type === "match").length, [entries]);
	const groupsCount = useMemo(() => entries.filter((e) => e.type === "group").length, [entries]);

	return (
		<main className="screen-nav-host">
			{/* ── Header ── */}
			<div className="flex items-center justify-between px-4 py-3">
				<div className="flex items-center gap-3">
					<h1 className="text-xl font-display text-foreground tracking-wide">
						Chats
					</h1>
					<button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-white">
						<PenSquare className="h-4 w-4" />
					</button>
				</div>
			</div>

			{/* ── Tabs ── */}
			<div className="flex gap-1 border-b border-line px-4">
				{TABS.map((tab) => {
					const count = tab.id === "all" ? entries.length
						: tab.id === "unread" ? unreadCount
						: tab.id === "matches" ? matchesCount
						: groupsCount;
					return (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
								activeTab === tab.id
									? "border-gold text-gold"
									: "border-transparent text-muted-foreground hover:text-foreground"
							)}
						>
							{tab.label}
							{count > 0 && (
								<span className={cn(
									"rounded-full px-1.5 py-0.5 text-[10px] font-bold",
									activeTab === tab.id
										? "bg-gold/20 text-gold"
										: "bg-white/10 text-muted-foreground"
								)}>
									{count}
								</span>
							)}
						</button>
					);
				})}
			</div>

			{/* ── Content ── */}
			{loading ? (
				<ChatListSkeleton />
			) : error ? (
				<div className="flex flex-col items-center gap-4 py-12">
					<div className="glass-card p-6 text-center">
						<p className="text-red-400 font-display text-lg">
							Failed to load messages
						</p>
						<p className="text-muted-foreground text-xs mt-2 font-mono">
							{error.message}
						</p>
					</div>
				</div>
			) : filteredEntries.length === 0 ? (
				<EmptyState
					icon={MessageCircle}
					title={
						activeTab === "unread"
							? "No unread messages"
							: activeTab === "matches"
								? "No match conversations"
								: activeTab === "groups"
									? "No group chats"
									: "No conversations yet"
					}
					description={
						activeTab === "unread"
							? "You're all caught up!"
							: activeTab === "matches"
								? "Match with someone to start chatting."
								: activeTab === "groups"
									? "Join a group to start chatting."
									: "Start a conversation by tapping Message on someone's profile."
					}
				/>
			) : (
				<div className="px-2">
					{filteredEntries.map((entry, idx) => (
						<ChatRow
							key={entry.data.conversationId}
							entry={entry}
							index={idx}
						/>
					))}
				</div>
			)}
		</main>
	);
}

function toConversation(value: Record<string, unknown>): Conversation | null {
	if (value.type !== "full_conversation_v1") return null;
	if (!value.data || typeof value.data !== "object") return null;
	const data = value.data as Record<string, unknown>;
	if (
		typeof data.conversationId !== "string" ||
		typeof data.name !== "string" ||
		!Array.isArray(data.participants) ||
		typeof data.lastActivityTimestamp !== "number" ||
		typeof data.unreadCount !== "number"
	) {
		return null;
	}
	return value as unknown as Conversation;
}

/* ================================================================== */
/*  Chat Row                                                           */
/* ================================================================== */

function ChatRow({ entry, index }: { entry: Conversation; index: number }) {
	const d = entry.data;
	const hasUnread = d.unreadCount > 0;

	return (
		<Link
			to="/chat/$conversationId"
			params={{ conversationId: d.conversationId }}
			className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-white/[0.03] group"
			style={{ animationDelay: `${index * 30}ms` }}
		>
			{/* ── Avatar ── */}
			<div className="relative shrink-0">
				<div
					className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 group-hover:scale-105"
					style={{
						background: hasUnread
							? "linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.08))"
							: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
						border: hasUnread
							? "2px solid rgba(234,179,8,0.35)"
							: "1px solid rgba(255,255,255,0.06)",
						color: hasUnread ? "var(--accent-primary)" : "var(--text-muted)",
					}}
				>
					{d.name?.charAt(0)?.toUpperCase() ?? "?"}
				</div>
				{/* Online indicator */}
				{d.onlineUntil !== null && (
					<div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-[var(--color-background)]" />
				)}
				{/* Unread badge */}
				{hasUnread && (
					<div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red flex items-center justify-center text-white text-[9px] font-bold badge-pulse">
						{d.unreadCount > 99 ? "99+" : d.unreadCount}
					</div>
				)}
			</div>

			{/* ── Content ── */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					{d.pinned && (
						<Pin className="w-3 h-3 text-gold/50 shrink-0 -rotate-45" />
					)}
					<span
						className={`truncate text-sm ${hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}
					>
						{d.name}
					</span>
					{d.favorite && (
						<Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
					)}
				</div>
				<div className="flex items-center gap-1.5 mt-0.5">
					{d.preview && (
						<span
							className={`truncate text-xs ${hasUnread ? "text-foreground/60" : "text-muted-foreground/50"}`}
						>
							{d.preview}
						</span>
					)}
				</div>
			</div>

			{/* ── Right side ── */}
			<div className="flex flex-col items-end gap-1.5 shrink-0">
				{d.muted && (
					<VolumeX className="w-3.5 h-3.5 text-muted-foreground/30" />
				)}
				{hasUnread && (
					<div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">
						{d.unreadCount > 99 ? "99+" : d.unreadCount}
					</div>
				)}
			</div>
		</Link>
	);
}
