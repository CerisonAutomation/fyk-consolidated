import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "#/domains/auth/guard";
import { useConversationsStore } from "#/domains/chat/store";
import { Drafts } from "#/domains/chat/drafts-store";

export const Route = createFileRoute("/chat/")({
	beforeLoad: requireAuth,
	component: ChatListPage,
	loader: async () => {
		await useConversationsStore.getState().load();
	},
});

// ---- Helpers ----

const drafts = new Drafts();

function relativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const weeks = Math.floor(days / 7);

	if (seconds < 60) return "now";
	if (minutes < 60) return `${minutes}m`;
	if (hours < 24) return `${hours}h`;
	if (days < 7) return `${days}d`;
	return `${weeks}w`;
}

function previewText(entry: {
	data: {
		preview: string | null;
		conversationId: string;
	};
}): string {
	// Try to show a draft indicator if there's a saved draft
	const savedDraft = drafts.get(entry.data.conversationId);
	if (savedDraft) return `Draft: ${savedDraft}`;
	return entry.data.preview ?? "";
}

// ---- Component ----

function ChatListPage() {
	const { entries, loading, error } = useConversationsStore();

	return (
		<main className="screen-nav-host">
			<div className="flex items-center justify-between px-4 py-2">
				<h1 className="text-lg font-semibold">Messages</h1>
			</div>
			{loading ? (
				<div className="flex flex-col gap-2 p-4">
					{Array.from({ length: 8 }).map((_, i) => (
						<div key={i} className="flex items-center gap-3 animate-pulse">
							<div className="h-12 w-12 rounded-full bg-muted" />
							<div className="flex-1 space-y-2">
								<div className="h-4 w-32 rounded bg-muted" />
								<div className="h-3 w-48 rounded bg-muted" />
							</div>
						</div>
					))}
				</div>
			) : error ? (
				<div className="flex flex-col items-center gap-4 py-12">
					<p className="text-destructive">{error.message}</p>
				</div>
			) : entries.length === 0 ? (
				<div className="flex flex-1 items-center justify-center p-6">
					<span className="text-center text-xl text-muted-foreground">
						No conversations yet
					</span>
				</div>
			) : (
				<div className="flex flex-col">
					{entries.map((entry) => {
						const preview = previewText(entry);
						const isOnline = entry.data.onlineUntil !== null;
						const lastActivity = entry.data.lastActivityTimestamp;
						const hasDraft = drafts.get(entry.data.conversationId) !== "";

						return (
							<Link
								key={entry.data.conversationId}
								to="/chat/$conversationId"
								params={{ conversationId: entry.data.conversationId }}
								className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50"
							>
								{/* Avatar with online indicator */}
								<div className="relative h-12 w-12 flex-shrink-0">
									<div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
										{entry.data.name?.charAt(0) ?? "?"}
									</div>
									{isOnline && (
										<div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
									)}
								</div>

								{/* Name + preview */}
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										{entry.data.pinned && (
											<span className="text-xs text-muted-foreground">
												Pinned
											</span>
										)}
										<span
											className={`truncate ${
												entry.data.unreadCount > 0
													? "font-bold"
													: "font-medium"
											}`}
										>
											{entry.data.name}
										</span>
										{entry.data.favorite && (
											<span className="text-xs text-yellow-500">★</span>
										)}
									</div>
									<div className="flex items-center gap-2">
										{hasDraft && (
											<span className="text-xs text-muted-foreground italic">
												Draft
											</span>
										)}
										{preview && (
											<span
												className={`truncate text-sm ${
													entry.data.unreadCount > 0
														? "text-foreground font-medium"
														: "text-muted-foreground"
												}`}
											>
												{preview}
											</span>
										)}
									</div>
								</div>

								{/* Unread badge + time + mute */}
								<div className="flex flex-col items-end gap-1">
									{lastActivity && (
										<span className="text-xs text-muted-foreground">
											{relativeTime(lastActivity)}
										</span>
									)}
									<div className="flex items-center gap-1">
										{entry.data.muted && (
											<span className="text-xs text-muted-foreground">
												Muted
											</span>
										)}
										{entry.data.unreadCount > 0 && (
											<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
												{entry.data.unreadCount > 99
													? "99+"
													: entry.data.unreadCount}
											</span>
										)}
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</main>
	);
}
