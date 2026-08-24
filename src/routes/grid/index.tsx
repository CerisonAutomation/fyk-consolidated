import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Compass, SlidersHorizontal } from "lucide-react";
import type { GridSearchFilters } from "#/core/model/grid";

export const Route = createFileRoute("/grid/")({
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

/* ================================================================== */
/*  FYK Premium Grid (Discover)                                        */
/* ================================================================== */

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

	const [geohashState] = useState<string | null>(() => {
		const g = getPreferencesSnapshot().geohash;
		if (g) return g;
		setPreferences({ geohash: "dr5ru" });
		return "dr5ru";
	});
	const geohash = geohashState;

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
					<div
						className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
						style={{
							background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
						}}
					>
						<Compass className="w-8 h-8 text-gold/50" />
					</div>
					<h2 className="text-xl font-display text-foreground/90 tracking-wide">
						Set Your Location
					</h2>
					<p className="text-sm text-muted-foreground/60 max-w-xs">
						Enable location services to discover kings near you.
					</p>
				</div>
			</main>
		);
	}

	return (
		<main className="screen-nav-host">
			{/* ── Header ── */}
			<div className="flex items-center justify-between px-4 py-3">
				<div className="flex items-center gap-3">
					<h1 className="text-xl font-display text-foreground tracking-wide">
						Discover
					</h1>
					{refreshing && (
						<span className="text-[10px] font-mono text-gold/60 uppercase tracking-wider animate-pulse">
							Refreshing
						</span>
					)}
				</div>
				<button
					type="button"
					onClick={() => setFiltersOpen(true)}
					className="relative inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur px-3 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:border-gold/30 hover:text-gold hover:bg-gold/[0.04] transition-all duration-200"
					aria-label="Open filters"
				>
					<SlidersHorizontal className="size-3.5" />
					<span className="hidden sm:inline">Filters</span>
					{activeFilterCount > 0 && (
						<span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-black">
							{activeFilterCount}
						</span>
					)}
				</button>
			</div>

			{/* ── Quick Filter Chips ── */}
			<div className="flex gap-2 px-4 pb-3">
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

			{/* ── Refresh bar ── */}
			{refreshing && (
				<div className="flex items-center justify-center py-1">
					<div className="h-0.5 w-12 overflow-hidden rounded-full bg-white/[0.06]">
						<div className="h-full w-full origin-left animate-[pull-progress_1.5s_ease-in-out_infinite] bg-gold" />
					</div>
				</div>
			)}

			{/* ── Grid Content ── */}
			<div
				ref={gridContainer}
				className="pull-scroller h-full overflow-y-auto"
				onScroll={handleScroll}
			>
				<div className="@container/photo-grid flex min-h-[calc(100vh-4rem)] flex-col gap-4 px-4 pt-2 pb-24">
					{loading && items.length === 0 ? (
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
							{Array.from({ length: 12 }).map((_, i) => (
								<div
									key={i}
									className="aspect-[3/4] rounded-2xl overflow-hidden glass-card"
								>
									<div className="h-full w-full skeleton-pulse" />
								</div>
							))}
						</div>
					) : error ? (
						<div className="flex flex-col items-center gap-4 py-12">
							<div className="glass-card p-6 text-center">
								<p className="text-red-400 font-display text-lg">
									Something went wrong
								</p>
								<p className="text-muted-foreground/60 text-xs mt-1 font-mono">
									{error.message}
								</p>
								<button
									type="button"
									onClick={() => retry()}
									className="mt-4 px-5 py-2 rounded-xl border border-gold/25 text-gold font-display tracking-wider hover:border-gold/60 hover:bg-gold/5 transition-all"
								>
									Retry
								</button>
							</div>
						</div>
					) : items.length === 0 ? (
						<div className="flex flex-col items-center gap-4 py-12">
							<div className="glass-card p-6 text-center">
								<p className="text-foreground/70 font-display text-lg">
									No profiles found
								</p>
								<p className="text-muted-foreground/50 text-xs mt-1">
									Try adjusting your filters or location.
								</p>
								<button
									type="button"
									onClick={() => retry()}
									className="mt-4 px-5 py-2 rounded-xl border border-gold/25 text-gold font-display tracking-wider hover:border-gold/60 hover:bg-gold/5 transition-all"
								>
									Retry
								</button>
							</div>
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
										className="aspect-[3/4] rounded-2xl overflow-hidden glass-card"
									>
										<div className="h-full w-full skeleton-pulse" />
									</div>
								))}
						</div>
					)}
					{loadingMore && items.length > 0 && (
						<div className="flex justify-center py-4">
							<div className="h-6 w-6 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
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

/* ================================================================== */
/*  Quick Toggle Chip                                                  */
/* ================================================================== */

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
				"inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all duration-200",
				active
					? "border-gold/40 bg-gold/10 text-gold"
					: "border-white/[0.06] bg-white/[0.02] text-muted-foreground/60 hover:border-gold/20 hover:text-gold/60",
			].join(" ")}
			aria-pressed={active}
		>
			{label}
		</button>
	);
}

/* ================================================================== */
/*  Grid Cell — Premium Glass Card                                     */
/* ================================================================== */

const GridCell = memo(function GridCell({
	item,
}: {
	item: import("#/domains/grid/service").GridProfile;
}) {
	if (item.type === "lazy") {
		return (
			<div className="group relative aspect-[3/4] overflow-hidden rounded-2xl glass-card">
				<div className="h-full w-full skeleton-pulse" />
				<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2.5">
					<div className="h-3 w-16 rounded skeleton-pulse" />
				</div>
			</div>
		);
	}

	return (
		<Link
			to="/profile/$profileId"
			params={{ profileId: String(item.id) }}
			className="group relative aspect-[3/4] overflow-hidden rounded-2xl glass-card profile-card-romeo"
		>
			{item.profilePhotosHashes && item.profilePhotosHashes.length > 0 ? (
				<img
					src={`https://cdns.grindr.com/images/profile/480x480/${item.profilePhotosHashes[0]}`}
					alt={item.displayName ?? "Profile"}
					className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
					loading="lazy"
				/>
			) : (
				<div className="flex h-full items-center justify-center text-muted-foreground/40">
					<span className="text-xs font-mono">No photo</span>
				</div>
			)}

			{/* ── Profile overlay gradient ── */}
			<div className="profile-card-overlay" />

			{/* ── Bottom info ── */}
			<div className="absolute inset-x-0 bottom-0 p-2.5 pt-8 z-10">
				<div className="flex items-center gap-1">
					{item.isFavorite && (
						<span className="text-amber-400 drop-shadow-md text-xs">&#9733;</span>
					)}
					<span className="text-sm font-medium text-white drop-shadow-md">
						{item.displayName ?? "Anonymous"}
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					{item.distance !== null && (
						<span className="profile-card-distance text-[10px]">
							{item.distance < 1000
								? `${Math.round(item.distance)}m`
								: `${(item.distance / 1000).toFixed(1)}km`}
						</span>
					)}
					{item.unread !== null && item.unread > 0 && (
						<span className="profile-card-stat-badge bg-gold text-black">
							{item.unread > 99 ? "99+" : item.unread}
						</span>
					)}
				</div>
			</div>

			{/* ── Online status ── */}
			{item.onlineUntil !== null && (
				<div className="profile-card-online-dot" title="Online now" />
			)}
		</Link>
	);
});

/* ================================================================== */
/*  Grid Filters Drawer                                                */
/* ================================================================== */

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
		positionValue: filters.positions as unknown as number[],
		photosChecked: filters.photosEnabled,
		photosValue: filters.photos as unknown as string[],
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
					positions: next.positionValue as unknown as typeof filters.positions,
					photosEnabled: next.photosChecked,
					photos: next.photosValue as unknown as GridSearchFilters["photos"],
					tagsEnabled: next.tagsChecked,
					tags: next.tagsValue,
				});
				useGridStore.getState().retry();
			}}
		/>
	);
}
