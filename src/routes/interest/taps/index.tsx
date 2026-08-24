import { createFileRoute } from '@tanstack/react-router';
import { useTapsStore } from '#/domains/interest/store';

export const Route = createFileRoute('/interest/taps/')({
	component: TapsPage,
});

function TapsPage() {
	const { taps, loading, error, hasUnseen, hasMore, loadMore, markViewed } =
		useTapsStore();

	return (
		<main className="screen-nav-host">
			<div className="flex items-center justify-between px-4 py-2">
				<h1 className="text-lg font-semibold">Taps</h1>
				{hasUnseen && (
					<button
						onClick={markViewed}
						className="text-sm text-primary hover:underline"
					>
						Mark all as seen
					</button>
				)}
			</div>
			{loading ? (
				<div className="flex flex-col gap-2 p-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="flex items-center gap-3 animate-pulse">
							<div className="h-12 w-12 rounded-full bg-muted" />
							<div className="flex-1 space-y-2">
								<div className="h-4 w-32 rounded bg-muted" />
								<div className="h-3 w-24 rounded bg-muted" />
							</div>
						</div>
					))}
				</div>
			) : error ? (
				<div className="flex flex-col items-center gap-4 py-12">
					<p className="text-destructive">{error.message}</p>
				</div>
			) : taps.length === 0 ? (
				<div className="flex flex-1 items-center justify-center p-6">
					<span className="text-center text-xl text-muted-foreground">
						No taps received yet
					</span>
				</div>
			) : (
				<div className="flex flex-col">
					{taps.map((tap) => (
						<a
							key={tap.profileId}
							href={`/profile/${tap.profileId}`}
							className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50"
						>
							<div className="relative h-12 w-12 flex-shrink-0">
								<div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
									{tap.displayName?.charAt(0) ?? '?'}
								</div>
								{tap.isMutual && (
									<div className="absolute -bottom-0.5 -right-0.5 text-xs">💚</div>
								)}
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="truncate font-medium">
										{tap.displayName ?? 'Anonymous'}
									</span>
									{tap.isFavorite && (
										<span className="text-yellow-400">★</span>
									)}
								</div>
								<div className="text-sm text-muted-foreground">
									Tapped {formatTimeAgo(tap.timestamp)}
								</div>
							</div>
							{tap.isMutual && (
								<span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600">
									Mutual
								</span>
							)}
						</a>
					))}
					{hasMore && (
						<button
							onClick={loadMore}
							className="py-4 text-center text-sm text-primary hover:underline"
						>
							Load more
						</button>
					)}
				</div>
			)}
		</main>
	);
}

function formatTimeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
