"use client";

import { useQuery } from "@tanstack/react-query";
import {
	ChevronDown,
	Home,
	Map,
	MapPin,
	MessageCircle,
	Shield,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { candidatesToPins } from "#/components/map/candidate-pins";
import { FYKMap } from "#/components/map/FYKMap";
import { MapSearchBar } from "#/components/map/MapSearchBar";
import { getSupabase } from "#/integrations/supabase/client";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import type { GeocodingFeature } from "#/lib/geocoding";
import { EmptyState } from "@/components/ui/primitives";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface City {
	id: string;
	name: string;
	country: string;
	flag: string;
	onlineCount: number;
	photo: string;
}

interface ExploreProfile {
	id: string;
	name: string;
	age: number | null;
	photo: string;
	distance: number;
	status: "online" | "active" | "offline";
	verified: boolean;
	hosting: boolean;
	lookingFor: string[];
	tags: string[];
	headline: string | null;
	city: string | null;
}

type SortKey = "distance" | "recent";

// ─── Known cities ────────────────────────────────────────────────────────────

const KNOWN_CITIES: Record<
	string,
	{ name: string; country: string; flag: string; photo: string }
> = {
	valletta: {
		name: "Valletta",
		country: "Malta",
		flag: "\ud83c\uddf2\ud83c\uddf9",
		photo:
			"https://images.unsplash.com/photo-1584448062887-2a6e6d7f5b07?w=600&q=80",
	},
	london: {
		name: "London",
		country: "United Kingdom",
		flag: "\ud83c\uddec\ud83c\udde7",
		photo:
			"https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80",
	},
	berlin: {
		name: "Berlin",
		country: "Germany",
		flag: "\ud83c\udde9\ud83c\uddea",
		photo:
			"https://images.unsplash.com/photo-1560969184-10fe8719e047?w=600&q=80",
	},
	madrid: {
		name: "Madrid",
		country: "Spain",
		flag: "\ud83c\uddea\ud83c\uddf8",
		photo:
			"https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=600&q=80",
	},
	amsterdam: {
		name: "Amsterdam",
		country: "Netherlands",
		flag: "\ud83c\uddf3\ud83c\uddf1",
		photo:
			"https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=600&q=80",
	},
	nyc: {
		name: "New York",
		country: "United States",
		flag: "\ud83c\uddfa\ud83c\uddf8",
		photo:
			"https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80",
	},
	naxxar: {
		name: "Naxxar",
		country: "Malta",
		flag: "\ud83c\uddf2\ud83c\uddf9",
		photo:
			"https://images.unsplash.com/photo-1584448062887-2a6e6d7f5b07?w=600&q=80",
	},
};

const CITY_IDS = Object.keys(KNOWN_CITIES);

const FILTERS = [
	{ id: "online", label: "Online now", icon: Zap },
	{ id: "verified", label: "Verified", icon: Shield },
	{ id: "chat", label: "Looking for: Chat", icon: MessageCircle },
	{ id: "hosting", label: "Hosting tonight", icon: Home },
] as const;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
	{ value: "recent", label: "Recently active" },
	{ value: "distance", label: "Distance" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ExploreClient() {
	const pushToast = useAppStore((s) => s.pushToast);
	const { user: authUser } = useSupabaseSession();

	const [selectedCity, setSelectedCity] = useState("valletta");
	const [travelMode, setTravelMode] = useState(false);
	const [activeFilters, setActiveFilters] = useState<Set<string>>(
		new Set(["online"]),
	);
	const [sort, setSort] = useState<SortKey>("recent");
	const [layout, setLayout] = useState<"grid" | "list" | "map">("grid");
	const [customCities, setCustomCities] = useState<City[]>([]);

	// ── Handle MapSearchBar city selection ──────────────────────────────────
	const handleCitySearch = (feature: GeocodingFeature) => {
		const placeName = feature.name;
		const country =
			feature.context?.find((c) => c.id.startsWith("country"))?.text ?? "";
		const cityId = placeName.toLowerCase().replace(/\s+/g, "-");

		if (
			(citiesList ?? []).some((c) => c.id === cityId) ||
			customCities.some((c) => c.id === cityId)
		) {
			setSelectedCity(cityId);
			return;
		}

		const newCity: City = {
			id: cityId,
			name: placeName,
			country,
			flag: "\ud83c\udf0d",
			onlineCount: 0,
			photo: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${feature.center[0]},${feature.center[1]},12,0/400x200@2x?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? ""}`,
		};

		setCustomCities((prev) => [...prev, newCity]);
		setSelectedCity(cityId);
		pushToast(`Now exploring ${placeName}`, "success");
	};

	// ── Load city counts from Supabase ────────────────────────────────────
	const { data: citiesList } = useQuery({
		queryKey: ["explore", "cities"],
		queryFn: async (): Promise<City[]> => {
			const sb = getSupabase();
			if (!sb) return [];

			// Count users per city, with online count
			const { data: rows } = await sb
				.from("users")
				.select("city, online")
				.in("city", CITY_IDS)
				.eq("visible", true)
				.eq("hidden", false);

			if (!rows) return [];

			const cityCounts: Record<string, { total: number; online: number }> = {};
			for (const cityId of CITY_IDS) {
				cityCounts[cityId] = { total: 0, online: 0 };
			}

			for (const row of rows) {
				const cid = (row.city ?? "").toLowerCase();
				if (cityCounts[cid]) {
					cityCounts[cid].total++;
					if (row.online) cityCounts[cid].online++;
				}
			}

			return CITY_IDS.map((id) => {
				const meta = KNOWN_CITIES[id];
				const counts = cityCounts[id] ?? { total: 0, online: 0 };
				return {
					id,
					name: meta.name,
					country: meta.country,
					flag: meta.flag,
					onlineCount: counts.online || counts.total || 0,
					photo: meta.photo,
				};
			});
		},
		staleTime: 60_000,
	});

	// ── Load profiles for selected city ───────────────────────────────────
	const { data: profilesList, isLoading } = useQuery({
		queryKey: [
			"explore",
			"profiles",
			selectedCity,
			[...activeFilters].join(","),
			sort,
		],
		queryFn: async (): Promise<ExploreProfile[]> => {
			const sb = getSupabase();
			if (!sb) return [];

			let qb = sb
				.from("users")
				.select(
					"id, pseudo, nick, age, photos, city, area, headline, online, visible, hidden, incognito, last_active_at, created_at, looking_for, tribes",
				)
				.eq("visible", true)
				.eq("hidden", false)
				.eq("incognito", false)
				.neq("status", "suspended")
				.eq("city", selectedCity);

			if (authUser) {
				qb = qb.neq("id", authUser.id);
			}

			if (activeFilters.has("online")) {
				qb = qb.eq("online", true);
			}

			qb = qb.order("last_active_at", { ascending: false }).limit(60);

			const { data: rows, error } = await qb;
			if (error || !rows) return [];

			return rows.map((row: any) => {
				const photos = (row.photos as string[]) ?? [];
				const photo = photos[0] ?? "";
				const lookingFor = (row.looking_for as string[]) ?? [];
				const tribes = (row.tribes as string[]) ?? [];

				// Determine status from last_active_at
				const lastActive = new Date(row.last_active_at).getTime();
				const minutesSince = (Date.now() - lastActive) / 60_000;
				const status: ExploreProfile["status"] = row.online
					? "online"
					: minutesSince < 60
						? "active"
						: "offline";

				return {
					id: row.id,
					name: row.nick ?? row.pseudo ?? "Someone",
					age: row.age ?? null,
					photo,
					distance: 0.3,
					status,
					verified: false,
					hosting: lookingFor.includes("Hosting"),
					lookingFor,
					tags: tribes.slice(0, 3),
					headline: row.headline ?? null,
					city: row.city,
				};
			});
		},
		enabled: !!selectedCity,
	});

	const allCities = [...(citiesList ?? []), ...customCities];
	const selectedCityData = allCities.find((c) => c.id === selectedCity);

	// ── Sort ──────────────────────────────────────────────────────────────
	const sortedProfiles = [...(profilesList ?? [])].sort((a, b) => {
		if (sort === "recent") {
			return 0; // already sorted by last_active_at from Supabase
		}
		return a.distance - b.distance;
	});

	// ── Handlers ──────────────────────────────────────────────────────────
	const toggleTravelMode = () => {
		setTravelMode((t) => !t);
		pushToast(
			travelMode
				? "Travel mode off"
				: `Traveling \u00b7 visible in ${selectedCityData?.name ?? selectedCity} shortly`,
		);
	};

	const toggleFilter = (filterId: string) => {
		setActiveFilters((prev) => {
			const next = new Set(prev);
			if (next.has(filterId)) {
				next.delete(filterId);
			} else {
				next.add(filterId);
			}
			return next;
		});
	};

	// ── Render ────────────────────────────────────────────────────────────
	return (
		<div className="mx-auto max-w-6xl px-4 py-6">
			{/* Header */}
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-white">Explore</h1>
				<p className="mt-1 text-sm text-white/60">
					Pick a city and look around before you travel. See who's active and
					available.
				</p>
			</div>

			{/* City Search */}
			<div className="mb-4">
				<MapSearchBar
					placeholder="Search for any city worldwide..."
					onSelect={handleCitySearch}
				/>
			</div>

			{/* City Cards */}
			<div className="mb-6 flex gap-3 overflow-x-auto pb-2">
				{allCities.map((city) => (
					<button
						key={city.id}
						onClick={() => setSelectedCity(city.id)}
						className={cn(
							"group relative h-32 w-48 shrink-0 overflow-hidden rounded-2xl border transition-all",
							selectedCity === city.id
								? "border-yellow-500/50 ring-2 ring-yellow-500/30"
								: "border-white/10 hover:border-white/20",
						)}
					>
						<img
							src={city.photo}
							alt={city.name}
							className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
						<div className="absolute bottom-3 left-3 right-3">
							<p className="flex items-center gap-1 text-sm font-bold text-white">
								<span>{city.flag}</span> {city.name}
							</p>
							<p className="text-xs text-white/70">
								{city.country} \u00b7 {city.onlineCount.toLocaleString()} online
							</p>
						</div>
					</button>
				))}
			</div>

			{/* Travel Mode Banner */}
			<div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
				<div className="flex items-center gap-4">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
						<MapPin className="h-5 w-5 text-purple-400" />
					</div>
					<div className="flex-1">
						<p className="text-sm font-semibold text-white">
							Traveling to {selectedCityData?.name ?? selectedCity}? Turn on
							travel mode.
						</p>
						<p className="text-xs text-white/60">
							You appear in {selectedCityData?.name ?? selectedCity} from 3 days
							before arrival.
						</p>
					</div>
					<button
						onClick={toggleTravelMode}
						className={cn(
							"rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
							travelMode
								? "bg-purple-500 text-white hover:bg-purple-400"
								: "border border-white/20 bg-transparent text-white hover:bg-white/10",
						)}
					>
						{travelMode ? "Turn off" : "Turn on travel mode"}
					</button>
				</div>
			</div>

			{/* Filters */}
			<div className="mb-4 flex flex-wrap gap-2">
				{FILTERS.map((f) => {
					const Icon = f.icon;
					const isActive = activeFilters.has(f.id);
					return (
						<button
							key={f.id}
							onClick={() => toggleFilter(f.id)}
							className={cn(
								"flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
								isActive
									? "border-yellow-500/50 bg-yellow-500/15 text-yellow-400"
									: "border-white/20 bg-white/5 text-white/60 hover:text-white",
							)}
						>
							<Icon className="h-4 w-4" />
							{f.label}
						</button>
					);
				})}
			</div>

			{/* Results Bar */}
			<div className="mb-4 flex items-center justify-between">
				<p className="text-sm text-white/60">
					{sortedProfiles.length}{" "}
					{sortedProfiles.length === 1 ? "person" : "people"} nearby
				</p>
				<div className="flex items-center gap-3">
					{/* Layout Toggle */}
					<div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
						<button
							onClick={() => setLayout("list")}
							className={cn(
								"rounded-md px-2 py-1 text-xs transition-colors",
								layout === "list" ? "bg-white/10 text-white" : "text-white/40",
							)}
						>
							\u2630
						</button>
						<button
							onClick={() => setLayout("grid")}
							className={cn(
								"rounded-md px-2 py-1 text-xs transition-colors",
								layout === "grid" ? "bg-white/10 text-white" : "text-white/40",
							)}
						>
							\u229e
						</button>
						<button
							onClick={() => setLayout("map")}
							className={cn(
								"rounded-md px-2 py-1 text-xs transition-colors",
								layout === "map" ? "bg-white/10 text-white" : "text-white/40",
							)}
							aria-label="Map view"
						>
							<Map className="inline h-3.5 w-3.5" />
						</button>
					</div>

					{/* Sort */}
					<div className="relative">
						<select
							value={sort}
							onChange={(e) => setSort(e.target.value as SortKey)}
							className="appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 pr-8 text-sm text-white focus:border-yellow-500/50 focus:outline-none"
						>
							{SORT_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									Sort: {opt.label}
								</option>
							))}
						</select>
						<ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
					</div>
				</div>
			</div>

			{/* Profiles Grid */}
			{isLoading ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
					{Array.from({ length: 8 }).map((_, i) => (
						<div
							key={i}
							className="h-64 animate-pulse rounded-2xl bg-white/5"
						/>
					))}
				</div>
			) : sortedProfiles.length === 0 ? (
				<EmptyState
					icon="🔍"
					title={`No one in ${selectedCityData?.name ?? selectedCity} matches your search`}
					description="Try clearing your filters."
				/>
			) : layout === "map" ? (
				<FYKMap
					pins={candidatesToPins(
						sortedProfiles.map((p) => ({
							id: p.id,
							name: p.name,
							photoUrl: p.photo || undefined,
							distance: p.distance,
							online: p.status === "online",
							matchScore: p.verified ? 90 : undefined,
						})),
						authUser?.id ?? "explore-viewer",
					)}
					height={480}
					onSelect={() => {
						/* Could navigate to profile */
					}}
				/>
			) : layout === "grid" ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
					{sortedProfiles.map((profile, i) => (
						<div
							key={profile.id}
							className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20"
							style={{ animationDelay: `${Math.min(i * 40, 420)}ms` }}
						>
							{/* Headline Badge */}
							{profile.headline && (
								<div className="absolute left-3 top-3 z-10">
									<span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur">
										{profile.headline}
									</span>
								</div>
							)}

							{/* Online Indicator */}
							{profile.status === "online" && (
								<div className="absolute right-3 top-3 z-10">
									<span className="h-3 w-3 rounded-full bg-green-500 ring-2 ring-black/30" />
								</div>
							)}

							{/* Photo */}
							{profile.photo ? (
								<div className="relative h-48 overflow-hidden">
									<img
										src={profile.photo}
										alt={`${profile.name}${profile.age ? `, ${profile.age}` : ""}`}
										className="h-full w-full object-cover transition-transform group-hover:scale-105"
									/>
									<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
									<div className="absolute bottom-3 left-3 right-3">
										<p className="text-lg font-bold text-white">
											{profile.name}
											{profile.age ? `, ${profile.age}` : ""}
										</p>
										<p className="text-sm text-white/70">
											{profile.status === "online"
												? "Online now"
												: profile.status === "active"
													? "Active this hour"
													: "Active today"}
											{profile.hosting ? " \u00b7 Hosting" : ""}
										</p>
									</div>
								</div>
							) : (
								<div className="flex h-48 items-center justify-center bg-white/5">
									<span className="text-4xl text-white/20">
										{profile.name.charAt(0).toUpperCase()}
									</span>
								</div>
							)}

							{/* Tags */}
							<div className="p-3">
								<div className="flex flex-wrap gap-1.5">
									{profile.tags.slice(0, 3).map((tag) => (
										<span
											key={tag}
											className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60"
										>
											{tag}
										</span>
									))}
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{sortedProfiles.map((profile) => (
						<div
							key={profile.id}
							className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 transition-all hover:border-white/20"
						>
							{/* Photo */}
							<div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
								{profile.photo ? (
									<img
										src={profile.photo}
										alt={`${profile.name}${profile.age ? `, ${profile.age}` : ""}`}
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center bg-white/10 text-sm font-bold text-white/40">
										{profile.name.charAt(0).toUpperCase()}
									</div>
								)}
								{profile.status === "online" && (
									<span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-green-500 ring-2 ring-black/30" />
								)}
							</div>

							{/* Info */}
							<div className="min-w-0 flex-1">
								<p className="font-semibold text-white">
									{profile.name}
									{profile.age ? `, ${profile.age}` : ""}
								</p>
								<p className="text-sm text-white/60">
									{profile.status === "online"
										? "Online now"
										: profile.status === "active"
											? "Active this hour"
											: "Active today"}
									{profile.hosting ? " \u00b7 Hosting" : ""}
								</p>
							</div>

							{/* Tags */}
							<div className="hidden flex-wrap gap-1.5 sm:flex">
								{profile.tags.slice(0, 2).map((tag) => (
									<span
										key={tag}
										className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60"
									>
										{tag}
									</span>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
