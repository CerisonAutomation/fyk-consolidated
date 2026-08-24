import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { MessageCircle, Pin, Star, VolumeX } from "lucide-react";
import { useConversationsStore, type Conversation } from "#/domains/chat/store";
import {
	EmptyState,
	ChatListSkeleton,
} from "#/core/ui/fyk-primitives";

export const Route = createFileRoute("/chat/")({
	component: ChatListPage,
});

/* ================================================================== */
/*  FYK Premium Chat List                                              */
/* ================================================================== */

function ChatListPage() {
	const { entries, loading, error } = useConversationsStore();

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

	return (
		<main className="screen-nav-host">
			{/* ── Header ── */}
			<div className="flex items-center justify-between px-4 py-3">
				<div className="flex items-center gap-3">
					<h1 className="text-xl font-display text-foreground tracking-wide">
						Messages
					</h1>
					{entries.length > 0 && (
						<span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
							{entries.length} {entries.length === 1 ? "thread" : "threads"}
						</span>
					)}
				</div>
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
			) : sortedEntries.length === 0 ? (
				<EmptyState
					icon={MessageCircle}
					title="No conversations yet"
					description="Start a conversation by tapping Message on someone's profile."
				/>
			) : (
				<div className="px-2">
					{sortedEntries.map((entry, idx) => (
						<ChatRow key={entry.data.conversationId} entry={entry} index={idx} />
					))}
				</div>
			)}
		</main>
	);
}

/* ================================================================== */
/*  Chat Row                                                           */
/* ================================================================== */

function ChatRow({
	entry,
	index,
}: {
	entry: Conversation;
	index: number;
}) {
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
