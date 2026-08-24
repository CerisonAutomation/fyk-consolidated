import { createFileRoute } from '@tanstack/react-router';
import { useConversationsStore } from '#/domains/chat/store';

export const Route = createFileRoute('/chat/')({
	component: ChatListPage,
});

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
					{entries.map((entry) => (
						<a
							key={entry.data.conversationId}
							href={`/chat/${entry.data.conversationId}`}
							className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50"
						>
							<div className="relative h-12 w-12 flex-shrink-0">
								<div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
									{entry.data.name?.charAt(0) ?? '?'}
								</div>
								{entry.data.onlineUntil !== null && (
									<div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
								)}
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									{entry.data.pinned && (
										<span className="text-xs text-muted-foreground">📌</span>
									)}
									<span className="truncate font-medium">
										{entry.data.name}
									</span>
									{entry.data.favorite && (
										<span className="text-yellow-400">★</span>
									)}
								</div>
								<div className="flex items-center gap-2">
									{entry.data.preview && (
										<span className="truncate text-sm text-muted-foreground">
											{entry.data.preview}
										</span>
									)}
								</div>
							</div>
							<div className="flex flex-col items-end gap-1">
								{entry.data.unreadCount > 0 && (
									<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
										{entry.data.unreadCount}
									</span>
								)}
								{entry.data.muted && (
									<span className="text-xs text-muted-foreground">🔇</span>
								)}
							</div>
						</a>
					))}
				</div>
			)}
		</main>
	);
}
