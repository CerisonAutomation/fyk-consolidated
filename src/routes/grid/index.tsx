import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useGridStore } from '#/domains/grid/store';
import { hydratePreferences, getPreferencesSnapshot } from '#/domains/settings/preferences';

export const Route = createFileRoute('/grid/')({
	component: GridPage,
});

function GridPage() {
	const gridContainer = useRef<HTMLDivElement>(null);
	const {
		items,
		loading,
		error,
		refreshing,
		load,
		refresh,
		loadMore,
		retry,
	} = useGridStore();

	useEffect(() => {
		hydratePreferences();
		const geohash = getPreferencesSnapshot().geohash;
		if (geohash) {
			load(geohash);
		}
	}, [load]);

	const handleScroll = () => {
		const container = gridContainer.current;
		if (!container) return;
		useGridStore.setState({ scrollY: container.scrollTop });

		// Load more when near bottom
		if (
			container.scrollTop + container.clientHeight >=
			container.scrollHeight - 200
		) {
			loadMore();
		}
	};

	const geohash = getPreferencesSnapshot().geohash;

	if (geohash === null) {
		return (
			<main className="m-auto flex max-w-full flex-1">
				<div className="flex flex-col items-center gap-4 p-8 text-center">
					<h2 className="text-xl font-semibold">Set Your Location</h2>
					<p className="text-muted-foreground">
						Enable location services to discover profiles near you.
					</p>
				</div>
			</main>
		);
	}

	return (
		<main className="screen-nav-host">
			<div className="flex items-center justify-between px-4 py-2">
				<h1 className="text-lg font-semibold">Discover</h1>
				{refreshing && (
					<span className="text-sm text-muted-foreground">Refreshing...</span>
				)}
			</div>
			<div
				ref={gridContainer}
				className="pull-scroller h-full overflow-y-auto"
				onScroll={handleScroll}
			>
				<div className="@container/photo-grid flex min-h-[calc(100vh-4rem)] flex-col gap-4 px-4 pt-4 pb-20">
					{loading && items.length === 0 ? (
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
							{Array.from({ length: 12 }).map((_, i) => (
								<div
									key={i}
									className="aspect-[3/4] animate-pulse rounded-lg bg-muted"
								/>
							))}
						</div>
					) : error ? (
						<div className="flex flex-col items-center gap-4 py-12">
							<p className="text-destructive">{error.message}</p>
							<button
								onClick={() => retry()}
								className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
							>
								Retry
							</button>
						</div>
					) : items.length === 0 ? (
						<div className="flex flex-col items-center gap-4 py-12">
							<p className="text-muted-foreground">No profiles found</p>
							<button
								onClick={() => retry()}
								className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
							>
								Retry
							</button>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
							{items.map((item) => (
								<GridCell key={item.id} item={item} />
							))}
						</div>
					)}
					{loadingMore && (
						<div className="flex justify-center py-4">
							<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
						</div>
					)}
				</div>
			</div>
		</main>
	);
}

function GridCell({ item }: { item: import('#/domains/grid/service').GridProfile }) {
	if (item.type === 'lazy') {
		return (
			<div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
		);
	}

	return (
		<a
			href={`/profile/${item.id}`}
			className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-muted"
		>
			{item.profilePhotosHashes && item.profilePhotosHashes.length > 0 ? (
				<img
					src={`https://cdns.grindr.com/images/profile/480x480/${item.profilePhotosHashes[0]}`}
					alt={item.displayName ?? 'Profile'}
					className="h-full w-full object-cover"
					loading="lazy"
				/>
			) : (
				<div className="flex h-full items-center justify-center text-muted-foreground">
					No photo
				</div>
			)}
			<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
				<div className="flex items-center gap-1">
					{item.isFavorite && (
						<span className="text-yellow-400">★</span>
					)}
					<span className="text-sm font-medium text-white">
						{item.displayName ?? 'Anonymous'}
					</span>
				</div>
				{item.distance !== null && (
					<span className="text-xs text-white/80">
						{item.distance < 1000
							? `${Math.round(item.distance)}m`
							: `${(item.distance / 1000).toFixed(1)}km`}
					</span>
				)}
				{item.unread !== null && item.unread > 0 && (
					<span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
						{item.unread}
					</span>
				)}
			</div>
			{item.onlineUntil !== null && (
				<div className="absolute right-2 top-2 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
			)}
		</a>
	);
}
