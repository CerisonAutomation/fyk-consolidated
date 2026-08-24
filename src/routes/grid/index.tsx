import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "#/domains/auth/guard";
import { memo, useCallback, useRef, useState } from "react";
import { useGridStore } from "#/domains/grid/store";
import { useGridSearchFiltersStore } from "#/domains/grid/filters-store";
import {
	getPreferencesSnapshot,
	hydratePreferences,
	setPreferences,
} from "#/domains/settings/preferences";
import {
	GridFilters,
	type GridFiltersState,
} from "#/core/ui/organisms/filters/GridFilters";
import { SlidersHorizontal } from "lucide-react";
import type { GridSearchFilters } from "#/core/model/grid";

export const Route = createFileRoute("/grid/")({
	beforeLoad: requireAuth,
	component: GridPage,
	loader: async () => {
		hydratePreferences();
		let geohash = getPreferencesSnapshot().geohash;
		if (!geohash) {
			geohash = "dr5ru";
			await setPreferences({ geohash });
		}
		if (geohash) {
			await useGridStore.getState().load(geohash);
		}
	},
});

function GridPage() {
	const gridContainer = useRef<HTMLDivElement>(null);
	const { items, loading, loadingMore, error, refreshing, loadMore, retry } =
		useGridStore();
	const filters = useGridSearchFiltersStore((s) => s.value);
	const setFilters = useGridSearchFiltersStore((s) => s.setFilters);

	const [filtersOpen, setFiltersOpen] = useState(false);

	const handleScroll = useCallback(() => {
		const container = gridContainer.current;
		if (!container) return;
		useGridStore.setState({ scrollY: container.scrollTop });

		if (
			container.scrollTop + container.clientHeight >=
			container.scrollHeight - 200
		) {
			loadMore();
		}
	}, [loadMore]);

	const geohash = getPreferencesSnapshot().geohash;

	const activeFilterCount = filters
		? [
				filters.ageEnabled,
				filters.genderEnabled,
				filters.positionEnabled,
				filters.photosEnabled,
				filters.tribesEnabled,
				filters.bodyTypesEnabled,
				filters.heightEnabled,
				filters.weightEnabled,
				filters.relationshipStatusesEnabled,
				filters.acceptNSFWPicsEnabled,
				filters.lookingForEnabled,
				filters.meetAtEnabled,
				filters.haventChattedTodayEnabled,
				filters.healthPracticesEnabled,
				filters.tagsEnabled,
			].filter(Boolean).length
		: 0;

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
				<div className="flex items-center gap-2">
					{refreshing && (
						<span className="text-sm text-muted-foreground">Refreshing...</span>
					)}
					<button
						type="button"
						onClick={() => setFiltersOpen(true)}
						className="relative inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
						aria-label="Open filters"
					>
						<SlidersHorizontal className="size-4" />
						<span className="hidden sm:inline">Filters</span>
						{activeFilterCount > 0 && (
							<span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
								{activeFilterCount}
							</span>
						)}
					</button>
				</div>
			</div>

			<div className="flex gap-2 px-4 pb-2">
				<QuickToggleChip
					label="Favorites"
					active={filters?.isFavorite ?? false}
					onClick={() => {
						setFilters({ isFavorite: !(filters?.isFavorite ?? false) });
						useGridStore.getState().retry();
					}}
				/>
				<QuickToggleChip
					label="Online"
					active={filters?.isOnline ?? false}
					onClick={() => {
						setFilters({ isOnline: !(filters?.isOnline ?? false) });
						useGridStore.getState().retry();
					}}
				/>
			</div>

			{refreshing && (
				<div className="flex items-center justify-center py-1">
					<div className="h-0.5 w-12 overflow-hidden rounded-full bg-muted">
						<div className="h-full w-full origin-left animate-[pull-progress_1.5s_ease-in-out_infinite] bg-primary" />
					</div>
				</div>
			)}

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
							{loadingMore &&
								Array.from({ length: 4 }).map((_, i) => (
									<div
										key={`skeleton-${i}`}
										className="aspect-[3/4] animate-pulse rounded-lg bg-muted"
									/>
								))}
						</div>
					)}
					{loadingMore && items.length > 0 && (
						<div className="flex justify-center py-4">
							<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
						</div>
					)}
				</div>
			</div>

			<GridFiltersDrawer
				open={filtersOpen}
				onClose={() => setFiltersOpen(false)}
			/>
		</main>
	);
}

function QuickToggleChip({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				"inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
				active
					? "border-primary bg-primary text-primary-foreground"
					: "border-border bg-background text-muted-foreground hover:bg-muted",
			].join(" ")}
			aria-pressed={active}
		>
			{label}
		</button>
	);
}

function GridFiltersDrawer({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const filters = useGridSearchFiltersStore((s) => s.value);
	const setFilters = useGridSearchFiltersStore((s) => s.setFilters);

	if (!filters || !open) return null;

	const gridFiltersState = {
		ageChecked: filters.ageEnabled,
		ageValue: filters.age,
		heightChecked: filters.heightEnabled,
		heightValue: filters.height,
		weightChecked: filters.weightEnabled,
		weightValue: filters.weight,
		genderChecked: filters.genderEnabled,
		genderValue: filters.genders,
		positionChecked: filters.positionEnabled,
		positionValue: filters.positions as number[],
		photosChecked: filters.photosEnabled,
		photosValue: filters.photos as string[],
		tagsChecked: filters.tagsEnabled,
		tagsValue: filters.tags,
	} satisfies GridFiltersState;

	return (
		<GridFilters
			open={open}
			onClose={onClose}
			filters={gridFiltersState}
			onFiltersChange={(next) => {
				setFilters({
					ageEnabled: next.ageChecked,
					age: next.ageValue as GridSearchFilters["age"],
					heightEnabled: next.heightChecked,
					height: next.heightValue as GridSearchFilters["height"],
					weightEnabled: next.weightChecked,
					weight: next.weightValue as GridSearchFilters["weight"],
					genderEnabled: next.genderChecked,
					genders: next.genderValue as GridSearchFilters["genders"],
					positionEnabled: next.positionChecked,
					positions: next.positionValue as GridSearchFilters["positions"],
					photosEnabled: next.photosChecked,
					photos: next.photosValue as GridSearchFilters["photos"],
					tagsEnabled: next.tagsChecked,
					tags: next.tagsValue,
				});
				useGridStore.getState().retry();
			}}
		/>
	);
}

const GridCell = memo(function GridCell({
	item,
}: {
	item: import("#/domains/grid/service").GridProfile;
}) {
	if (item.type === "lazy") {
		return (
			<div className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
				<div className="absolute inset-0 animate-pulse bg-muted" />
				<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
					<div className="h-3 w-16 animate-pulse rounded bg-white/20" />
				</div>
			</div>
		);
	}

	return (
		<Link
			to="/profile/$profileId"
			params={{ profileId: String(item.id) }}
			className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-muted"
		>
			{item.profilePhotosHashes && item.profilePhotosHashes.length > 0 ? (
				<img
					src={`https://cdns.grindr.com/images/profile/480x480/${item.profilePhotosHashes[0]}`}
					alt={item.displayName ?? "Profile"}
					className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
					loading="lazy"
				/>
			) : (
				<div className="flex h-full items-center justify-center text-muted-foreground">
					No photo
				</div>
			)}
			<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2 pt-6">
				<div className="flex items-center gap-1">
					{item.isFavorite && (
						<span className="text-yellow-400 drop-shadow-md">&#9733;</span>
					)}
					<span className="text-sm font-medium text-white drop-shadow-md">
						{item.displayName ?? "Anonymous"}
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					{item.distance !== null && (
						<span className="text-xs text-white/80">
							{item.distance < 1000
								? `${Math.round(item.distance)}m`
								: `${(item.distance / 1000).toFixed(1)}km`}
						</span>
					)}
					{item.unread !== null && item.unread > 0 && (
						<span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
							{item.unread > 99 ? "99+" : item.unread}
						</span>
					)}
				</div>
			</div>
			{item.onlineUntil !== null && (
				<div
					className="absolute right-2 top-2 h-3 w-3 rounded-full bg-green-500 ring-2 ring-black/20"
					title="Online now"
				/>
			)}
		</Link>
	);
});
