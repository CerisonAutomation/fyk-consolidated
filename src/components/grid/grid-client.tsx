import { Link } from "@tanstack/react-router";
import {
	Compass,
	Grid3X3,
	List,
	Map,
	MapPin,
	RefreshCw,
	ShieldCheck,
	SlidersHorizontal,
	Sparkles,
	Wifi,
	Zap,
} from "lucide-react";
import {
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { GridSearchFilters } from "#/core/model/grid";
import {
	GridFilters,
	type GridFiltersState,
} from "#/core/ui/organisms/filters/GridFilters";
import {
	initGridSearchFilters,
	useGridSearchFiltersStore,
} from "#/domains/grid/filters-store";
import { useGridStore } from "#/domains/grid/store";
import {
	getPreferencesSnapshot,
	setPreferences,
} from "#/domains/settings/preferences";
import { FYKMap } from "#/components/map/FYKMap";
import { candidatesToPins } from "#/components/map/candidate-pins";
import { cn } from "#/utils/cn";


const GRID_SKELETON_IDS = Array.from(
	{ length: 12 },
	(_, index) => `grid-loading-${index}`,
);
const LOAD_MORE_SKELETON_IDS = [
	"more-one",
	"more-two",
	"more-three",
	"more-four",
];

/* ================================================================== */
/*  FYK Premium Grid (Discover)                                        */
/* ================================================================== */

function GridPage() {
	const gridContainer = useRef<HTMLDivElement>(null);
	const {
		items,
		loading,
		loadingMore,
		error,
		refreshing,
		loadMore,
		refresh,
		retry,
	} = useGridStore();
	const filters = useGridSearchFiltersStore((s) => s.value);
	const setFilters = useGridSearchFiltersStore((s) => s.setFilters);

	const [filtersOpen, setFiltersOpen] = useState(false);
	const [viewMode, setViewMode] = useState<"grid" | "map" | "list">("grid");

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

	// Zustand state is not serialized with TanStack Router's loader cache during
	// hydration. Ensure the browser-owned store is populated on direct visits as
	// well as client-side navigation.
	useEffect(() => {
		void initGridSearchFilters().then(() => {
			if (geohash) void useGridStore.getState().load(geohash);
		});
	}, [geohash]);

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
	const renderedProfiles = items.filter((item) => item.type === "rendered");
	const onlineCount = renderedProfiles.filter(
		(item) => item.onlineUntil !== null && item.onlineUntil > Date.now(),
	).length;

	if (geohash === null) {
		return (
			<main className="m-auto flex max-w-full flex-1">
				<div className="flex flex-col items-center gap-4 p-8 text-center">
					<div
						className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
						style={{
							background:
								"color-mix(in srgb, var(--accent-primary) 10%, transparent)",
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
			{/* ── Production Nearby header, mirrored from FYK Zenith ── */}
			<header className="mx-3 mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 shadow-[0_20px_60px_-42px_rgba(234,179,8,.55)] backdrop-blur-xl sm:mx-4 sm:p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="mb-1 flex items-center gap-2">
							<span className="inline-flex size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
							<span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
								{onlineCount} online near you
							</span>
						</div>
						<h1 className="font-display text-2xl tracking-wide text-white sm:text-3xl">
							Nearby
						</h1>
						<p className="mt-1 flex items-center gap-1.5 text-xs text-white/45">
							<ShieldCheck className="size-3 text-emerald-400/80" />
							Photo-first discovery. Exact locations stay private.
						</p>
					</div>
						<div className="flex shrink-0 gap-2">
							<button
								type="button"
								onClick={() => void refresh()}
								className="flex size-10 items-center justify-center rounded-xl border border-white/[0.09] bg-black/25 text-white/55 transition hover:border-gold/40 hover:text-gold"
								aria-label="Refresh nearby profiles"
							>
								<RefreshCw
									className={`size-4 ${refreshing ? "animate-spin" : ""}`}
								/>
							</button>
							<Link
								to="/right-now"
								className="flex size-10 items-center justify-center rounded-xl border border-white/[0.09] bg-black/25 text-white/55 transition hover:border-gold/40 hover:text-gold"
								aria-label="Open Right Now radar"
							>
								<MapPin className="size-4" />
							</Link>
							{/* View mode toggle */}
							<div className="flex items-center rounded-xl border border-white/[0.09] bg-black/25 p-0.5">
								<button
									type="button"
									onClick={() => setViewMode("grid")}
									className={cn(
										"flex size-9 items-center justify-center rounded-lg text-white/55 transition",
										viewMode === "grid" ? "bg-white/10 text-gold" : "hover:text-white/75",
									)}
									aria-label="Grid view"
									aria-pressed={viewMode === "grid"}
								>
									<Grid3X3 className="size-4" />
								</button>
								<button
									type="button"
									onClick={() => setViewMode("map")}
									className={cn(
										"flex size-9 items-center justify-center rounded-lg text-white/55 transition",
										viewMode === "map" ? "bg-white/10 text-gold" : "hover:text-white/75",
									)}
									aria-label="Map view"
									aria-pressed={viewMode === "map"}
								>
									<Map className="size-4" />
								</button>
								<button
									type="button"
									onClick={() => setViewMode("list")}
									className={cn(
										"flex size-9 items-center justify-center rounded-lg text-white/55 transition",
										viewMode === "list" ? "bg-white/10 text-gold" : "hover:text-white/75",
									)}
									aria-label="List view"
									aria-pressed={viewMode === "list"}
								>
									<List className="size-4" />
								</button>
							</div>
							<button
								type="button"
								onClick={() => setFiltersOpen(true)}
								className="relative inline-flex h-10 items-center gap-1.5 rounded-xl border border-gold/35 bg-gold/10 px-3 text-xs font-medium text-gold transition hover:bg-gold/15"
								aria-label="Open filters"
							>
								<SlidersHorizontal className="size-4" />
								<span className="hidden sm:inline">Filters</span>
								{activeFilterCount > 0 && (
									<span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-black">
										{activeFilterCount}
									</span>
								)}
							</button>
						</div>
				</div>
			</header>

			{/* ── Quick Filter Chips ── */}
			<div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
				<span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gold/50 bg-gold px-3 py-2 text-xs font-semibold text-black">
					<MapPin className="size-3.5" /> Nearby
				</span>
				<QuickToggleChip
					label="Favorites"
					icon={<Sparkles className="size-3.5" />}
					active={filters?.isFavorite ?? false}
					onClick={() => {
						setFilters({ isFavorite: !(filters?.isFavorite ?? false) });
						useGridStore.getState().retry();
					}}
				/>
				<QuickToggleChip
					label="Online"
					icon={<Wifi className="size-3.5" />}
					active={filters?.isOnline ?? false}
					onClick={() => {
						setFilters({ isOnline: !(filters?.isOnline ?? false) });
						useGridStore.getState().retry();
					}}
				/>
				<Link
					to="/right-now"
					className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs font-mono uppercase tracking-wider text-white/50 transition hover:border-gold/30 hover:text-gold"
				>
					<Zap className="size-3.5" /> Right Now
				</Link>
			</div>
			<div className="flex items-center justify-between px-4 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
				<span className="flex items-center gap-1.5">
					<Grid3X3 className="size-3.5 text-gold" /> {renderedProfiles.length}{" "}
					profiles
				</span>
				<span>{loadingMore ? "Loading more" : "Nearest first"}</span>
			</div>

			{/* ── Refresh bar ── */}
			{refreshing && (
				<div className="flex items-center justify-center py-1">
					<div className="h-0.5 w-12 overflow-hidden rounded-full bg-white/[0.06]">
						<div className="h-full w-full origin-left animate-[pull-progress_1.5s_ease-in-out_infinite] bg-gold" />
					</div>
				</div>
			)}

			{/* ── Content ── */}
			{viewMode === "map" ? (
				<div className="px-4 pt-2 pb-24">
					<FYKMap
						pins={candidatesToPins(
							renderedProfiles.map((item) => ({
								id: String(item.id),
								displayName: item.displayName ?? undefined,
								photoUrl: item.photoUrl ?? undefined,
								distance: item.distance ?? undefined,
								online:
									item.onlineUntil !== null && item.onlineUntil > Date.now(),
								// The ring is only drawn when a real score exists, and the pin's
								// accent follows it; `null` means "no viewer to compare with".
								matchScore: item.compatibilityScore ?? undefined,
								geo: (item as any).geo,
							})),
							"grid-viewer",
						)}
						height={480}
						onSelect={() => {
							/* Could navigate to profile */
						}}
					/>
				</div>
			) : (
			<div
				ref={gridContainer}
				className="pull-scroller h-full overflow-y-auto"
				onScroll={handleScroll}
			>
				<div className="@container/photo-grid flex min-h-[calc(100vh-4rem)] flex-col gap-4 px-4 pt-2 pb-24">
					{loading && items.length === 0 ? (
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
							{GRID_SKELETON_IDS.map((id) => (
								<div
									key={id}
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
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
							{items.map((item) => (
								<GridCell key={item.id} item={item} />
							))}
							{loadingMore &&
								LOAD_MORE_SKELETON_IDS.map((id) => (
									<div
										key={id}
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
			)}

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
	icon,
	active,
	onClick,
}: {
	label: string;
	icon?: ReactNode;
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
			{icon}
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
		return <LazyGridCell profileId={item.id} />;
	}

	return (
		<Link
			to="/profile/$profileId"
			params={{ profileId: String(item.id) }}
			className="group relative aspect-[3/4] overflow-hidden rounded-2xl glass-card profile-card-romeo"
		>
			{item.photoUrl ? (
				<img
					src={item.photoUrl}
					alt={item.displayName ?? "Profile"}
					className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
					loading="lazy"
				/>
			) : (
				<div className="flex h-full items-center justify-center text-muted-foreground/40">
					<span className="text-xs font-mono">No photo</span>
				</div>
			)}

			{/* ── Profile overlay gradient ── */}
			<div className="profile-card-overlay" />

			{/* ── Production card signals ── */}
			<div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-2.5">
				<div className="flex items-center gap-1.5">
					{item.isNew && (
						<span className="rounded-full border border-white/15 bg-black/55 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-white backdrop-blur">
							New
						</span>
					)}
					{item.isFavorite && (
						<span className="flex size-6 items-center justify-center rounded-full bg-gold text-xs text-black shadow-lg">
							★
						</span>
					)}
				</div>
{item.compatibilityScore !== null ? (
					<div
						className="grid size-8 place-items-center rounded-full p-[2px] shadow-lg"
						style={{
							background: `conic-gradient(${item.compatibilityScore >= 80 ? "#34d399" : "#eab308"} ${item.compatibilityScore * 3.6}deg, rgba(255,255,255,.14) 0deg)`,
						}}
						title={`${item.compatibilityScore}% compatibility`}
					>
						<span className="grid size-full place-items-center rounded-full bg-black/80 font-mono text-[9px] font-bold text-white backdrop-blur">
							{item.compatibilityScore}
						</span>
					</div>
				) : null}
			</div>

			{/* ── Bottom info ── */}
			<div className="absolute inset-x-0 bottom-0 z-10 p-3 pt-12">
				<div className="flex items-end justify-between gap-2">
					<span className="truncate text-base font-semibold text-white drop-shadow-md">
						{item.displayName ?? "Anonymous"}
						{item.age !== null && (
							<span className="ml-1 font-normal text-white/75">{item.age}</span>
						)}
					</span>
				</div>
				<div className="mt-1 flex min-w-0 items-center gap-1.5 text-white/65">
					{item.distance !== null && (
						<span className="inline-flex items-center gap-1 text-[10px]">
							<MapPin className="size-2.5" />
							{item.distance < 1000
								? `${Math.round(item.distance)}m`
								: `${(item.distance / 1000).toFixed(1)}km`}
						</span>
					)}
					{item.position && (
						<span className="rounded-full border border-white/10 bg-black/35 px-1.5 py-0.5 text-[9px] backdrop-blur">
							{item.position}
						</span>
					)}
					{item.unread !== null && item.unread > 0 && (
						<span className="ml-auto rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-black">
							{item.unread > 99 ? "99+" : item.unread}
						</span>
					)}
				</div>
				{item.headline && (
					<p className="mt-1 truncate text-[10px] leading-tight text-white/45">
						{item.headline}
					</p>
				)}
			</div>

			{/* ── Online status ── */}
			{item.onlineUntil !== null && (
				<div className="profile-card-online-dot" title="Online now" />
			)}
		</Link>
	);
});

function LazyGridCell({ profileId }: { profileId: string }) {
	useEffect(() => {
		void useGridStore.getState().resolveProfile(profileId);
	}, [profileId]);

	return (
		<div className="group relative aspect-[3/4] overflow-hidden rounded-2xl glass-card">
			<div className="h-full w-full skeleton-pulse" />
			<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2.5">
				<div className="h-3 w-16 rounded skeleton-pulse" />
			</div>
		</div>
	);
}

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


export { GridPage };
