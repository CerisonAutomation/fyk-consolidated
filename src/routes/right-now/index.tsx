import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Camera,
	Car,
	Clock,
	Coffee,
	Dumbbell,
	Gamepad2,
	Map,
	MapPin,
	MessageCircle,
	PartyPopper,
	Plus,
	UtensilsCrossed,
	X,
	Zap,
} from "lucide-react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";
import { useSupabaseSession } from "@/integrations/supabase/session-provider";
import { onlineUntil } from "@/lib/compatibility";
import { useAppStore } from "@/lib/store";
import { watchLocation, type GeoState } from "@/lib/geo";
import { FYKMap, type MapPinItem } from "@/components/map/FYKMap";
import { cn } from "@/utils/cn";

export const Route = createFileRoute("/right-now/")({
	component: RightNowPage,
});

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
	{ label: "Looking to chat", icon: MessageCircle, color: "#3b82f6" },
	{ label: "Down to hang", icon: Coffee, color: "#22c55e" },
	{ label: "At the gym", icon: Dumbbell, color: "#f59e0b" },
	{ label: "At a party", icon: PartyPopper, color: "#ec4899" },
	{ label: "On my way", icon: Car, color: "#8b5cf6" },
	{ label: "Grabbing food", icon: UtensilsCrossed, color: "#f97316" },
	{ label: "Gaming", icon: Gamepad2, color: "#06b6d4" },
	{ label: "Free tonight", icon: Zap, color: "#EAAB08" },
];

interface ActiveStatus {
	type: string;
	message: string;
	startedAt: number;
	shareLocation: boolean;
	photoDataUrl?: string;
}

interface NearbyUser {
	id: string;
	name: string;
	avatar: string;
	status: string;
	online: boolean;
	lastActiveAt: string;
	city: string | null;
}

const RIGHT_NOW_STORAGE_KEY = "fyk:right-now:active-status";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadActiveStatus(): ActiveStatus | null {
	if (typeof window === "undefined") return null;
	try {
		const stored = window.localStorage.getItem(RIGHT_NOW_STORAGE_KEY);
		return stored ? (JSON.parse(stored) as ActiveStatus) : null;
	} catch {
		return null;
	}
}

function formatElapsed(startedAt: number) {
	const mins = Math.floor((Date.now() - startedAt) / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	return `${hours}h ${mins % 60}m ago`;
}

function timeAgo(dateStr: string) {
	const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

function RightNowPage() {
	const { user: authUser } = useSupabaseSession();
	const pushToast = useAppStore((s) => s.pushToast);

	const [activeStatus, setActiveStatus] = useState<ActiveStatus | null>(null);
	const [customMessage, setCustomMessage] = useState("");
	const [showComposer, setShowComposer] = useState(false);
	const [photoDataUrl, setPhotoDataUrl] = useState<string>();
	const photoInputRef = useRef<HTMLInputElement>(null);
	const [shareLocation, setShareLocation] = useState(false);
	const [geoState, setGeoState] = useState<GeoState | null>(null);
	const [showMap, setShowMap] = useState(false);

	// ── Load status from localStorage on mount ────────────────────────────
	useEffect(() => {
		setActiveStatus(loadActiveStatus());
	}, []);

	// ── Track location periodically ───────────────────────────────────────
	useEffect(() => {
		if (!shareLocation || !authUser) return;
		const stop = watchLocation((state) => {
			setGeoState(state);
			// Update presence with location data
			const sb = getSupabase();
			if (sb && state.coords) {
				sb.channel("right-now-presence").subscribe(async (status) => {
					if (status === "SUBSCRIBED") {
						await sb.channel("right-now-presence").track({
							user_id: authUser.id,
							lat: state.coords!.lat,
							lng: state.coords!.lng,
							city: state.city,
							online_at: new Date().toISOString(),
						});
					}
				});
			}
		});
		return () => {
			stop();
			getSupabase()?.channel("right-now-presence").unsubscribe();
		};
	}, [shareLocation, authUser]);

	// ── Load nearby active users from Supabase ────────────────────────────
	const { data: nearbyUsers } = useQuery({
		queryKey: ["right-now", "nearby"],
		queryFn: async (): Promise<NearbyUser[]> => {
			const sb = getSupabase();
			if (!sb || !authUser) return [];

			const city = geoState?.city ?? "valletta";
			// Fetch users in the same city who are online or recently active
			const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
			const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();

			// First try: online users in the city
			let { data: rows } = await sb
				.from("profiles")
				.select("id, display_name, handle, photos, city, area, online, last_active_at, hide_online")
				.eq("city", city)
				// One flag instead of the old `visible`/`hidden` pair: the mirror
				// already folds in suspension and incognito mode (0018).
				.eq("discoverable", true)
				.neq("id", authUser.id)
				.or(`online.eq.true,last_active_at.gt.${oneHourAgo}`)
				.order("last_active_at", { ascending: false })
				.limit(20);

			if (!rows || rows.length === 0) {
				// Fallback: show recently active users anywhere
				const result = await sb
					.from("profiles")
					.select("id, display_name, handle, photos, city, area, online, last_active_at, hide_online")
					.eq("discoverable", true)
					.neq("id", authUser.id)
					.or(`online.eq.true,last_active_at.gt.${fiveMinAgo}`)
					.order("last_active_at", { ascending: false })
					.limit(15);
				rows = result.data ?? [];
			}

			return rows.map((row: any) => {
				const photos = (row.photos as string[]) ?? [];
				return {
					id: row.id,
					name: row.handle ?? row.display_name ?? "Someone",
					avatar: photos[0] ?? "",
					// Presence is the shared rule, not the raw flag: `online` only
					// counts while the activity window is open, and someone who
					// hides their status is never shown as online.
					status:
						!row.hide_online &&
						onlineUntil(row.last_active_at, row.online) !== null
							? "Online now"
							: "Active recently",
					online: !row.hide_online && onlineUntil(row.last_active_at, row.online) !== null,
					lastActiveAt: row.last_active_at,
					city: row.city,
				};
			});
		},
		refetchInterval: 30_000,
	});

	// ── Track user presence ───────────────────────────────────────────────
	useEffect(() => {
		if (!authUser) return;
		const sb = getSupabase();
		if (!sb) return;

		const channel = sb.channel("right-now-presence");

		channel
			.on("presence", { event: "sync" }, () => {
				// Presence state synced — could read channel.presenceState() here
			})
			.subscribe(async (status) => {
				if (status === "SUBSCRIBED") {
					await channel.track({
						user_id: authUser.id,
						status: activeStatus?.type ?? "idle",
						online_at: new Date().toISOString(),
					});
				}
			});

		return () => {
			channel.unsubscribe();
		};
	}, [authUser, activeStatus?.type]);

	// ── Handlers ──────────────────────────────────────────────────────────
	const handlePostStatus = useCallback(
		(label: string) => {
			const nextStatus: ActiveStatus = {
				type: label,
				message: customMessage || label,
				startedAt: Date.now(),
				shareLocation,
				photoDataUrl,
			};
			setActiveStatus(nextStatus);
			window.localStorage.setItem(RIGHT_NOW_STORAGE_KEY, JSON.stringify(nextStatus));
			setShowComposer(false);
			setCustomMessage("");
			setPhotoDataUrl(undefined);
			pushToast(`Status set: ${label}`);
		},
		[customMessage, photoDataUrl, shareLocation, pushToast],
	);

	const handleClearStatus = useCallback(() => {
		setActiveStatus(null);
		window.localStorage.removeItem(RIGHT_NOW_STORAGE_KEY);
	}, []);

	const handlePhoto = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.addEventListener("load", () => {
			if (typeof reader.result === "string") setPhotoDataUrl(reader.result);
		});
		reader.readAsDataURL(file);
	}, []);

	const statusMeta = useMemo(
		() => STATUS_OPTIONS.find((s) => s.label === activeStatus?.type),
		[activeStatus?.type],
	);

	// ── Render ────────────────────────────────────────────────────────────
	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-lg px-4 py-4 pb-24">
					{/* Header */}
					<div className="mb-6 flex items-center justify-between">
						<div>
							<h1 className="font-display text-xl font-semibold tracking-wide text-white">
								Right Now
							</h1>
							<p className="mt-0.5 text-xs text-white/40">
								Share what you're up to \u00b7 See who's nearby
							</p>
						</div>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setShowMap(!showMap)}
								className={cn(
									"flex h-10 w-10 items-center justify-center rounded-xl border transition-all",
									showMap
										? "border-amber-500/30 bg-amber-500/15 text-amber-400"
										: "border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white/70",
								)}
								aria-label={showMap ? "Show list view" : "Show map view"}
								aria-pressed={showMap}
							>
								<Map className="h-4 w-4" />
							</button>
							<button
								type="button"
								onClick={() => setShowComposer(!showComposer)}
								className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all"
								style={{
									background: showComposer
										? "rgba(234,179,8,0.15)"
										: "rgba(255,255,255,0.05)",
									color: showComposer ? "#EAAB08" : "rgba(255,255,255,0.5)",
									border: `1px solid ${showComposer ? "rgba(234,179,8,0.3)" : "rgba(255,255,255,0.08)"}`,
								}}
							>
								{showComposer ? (
									<X className="h-4 w-4" />
								) : (
									<Plus className="h-4 w-4" />
								)}
								{showComposer ? "Cancel" : "Post"}
							</button>
						</div>
					</div>

					{/* Active Status Banner */}
					{activeStatus && (
						<div
							className="mb-6 overflow-hidden rounded-2xl"
							style={{
								background:
									"linear-gradient(135deg, rgba(234,179,8,0.12), rgba(234,179,8,0.04))",
								border: "1px solid rgba(234,179,8,0.2)",
							}}
						>
							<div className="flex items-center gap-3 p-4">
								<div
									className="flex h-12 w-12 items-center justify-center rounded-xl"
									style={{
										background:
											"linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.05))",
									}}
								>
									{statusMeta ? (
										<statusMeta.icon className="h-6 w-6" style={{ color: statusMeta.color }} />
									) : (
										<Zap className="h-6 w-6 text-amber-400" />
									)}
								</div>
								<div className="flex-1">
									<p className="text-sm font-medium text-amber-400">
										Your Status
									</p>
									<p className="text-xs text-white/60">
										{activeStatus.message}
									</p>
									{activeStatus.shareLocation && (
										<p className="mt-1 flex items-center gap-1 text-[10px] text-amber-300/60">
											<MapPin className="size-3" /> Approximate area shared
										</p>
									)}
									<p className="mt-0.5 text-[10px] text-white/30">
										<Clock className="mr-1 inline h-3 w-3" />
										{formatElapsed(activeStatus.startedAt)}
									</p>
								</div>
								<button
									type="button"
									onClick={handleClearStatus}
									className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
								>
									Clear
								</button>
							</div>
							{activeStatus.photoDataUrl && (
								<img
									src={activeStatus.photoDataUrl}
									alt="Your Right Now update"
									className="max-h-72 w-full border-t border-white/10 object-cover"
								/>
							)}
						</div>
					)}

					{/* Composer */}
					{showComposer && (
						<div
							className="mb-6 overflow-hidden rounded-2xl"
							style={{
								background: "rgba(255,255,255,0.03)",
								border: "1px solid rgba(255,255,255,0.06)",
							}}
						>
							<div className="p-4">
								<input
									ref={photoInputRef}
									type="file"
									accept="image/*"
									onChange={handlePhoto}
									hidden
								/>
								<textarea
									value={customMessage}
									onChange={(e) => setCustomMessage(e.target.value)}
									placeholder="What are you up to?"
									rows={3}
									maxLength={140}
									className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
									style={{ border: "1px solid rgba(255,255,255,0.08)" }}
								/>
								<div className="mt-2 flex items-center justify-between">
									<div className="flex items-center gap-3">
										<button
											type="button"
											onClick={() => photoInputRef.current?.click()}
											className="flex items-center gap-1.5 text-xs text-white/30 transition hover:text-white/50"
										>
											<Camera className="h-4 w-4" />
											{photoDataUrl ? "Change photo" : "Add photo"}
										</button>
										<button
											type="button"
											onClick={() => setShareLocation(!shareLocation)}
											className={`flex items-center gap-1.5 text-xs transition ${
												shareLocation
													? "text-amber-400"
													: "text-white/30 hover:text-white/50"
											}`}
										>
											<MapPin className="h-4 w-4" />
											Location
										</button>
									</div>
									<span className="text-[10px] text-white/20">
										{customMessage.length}/140
									</span>
								</div>
								{photoDataUrl && (
									<div className="relative mt-3 overflow-hidden rounded-xl border border-white/10">
										<img
											src={photoDataUrl}
											alt="Selected Right Now update"
											className="h-40 w-full object-cover"
										/>
										<button
											type="button"
											onClick={() => setPhotoDataUrl(undefined)}
											aria-label="Remove selected photo"
											className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
										>
											<X className="size-4" />
										</button>
									</div>
								)}
							</div>

							{/* Quick statuses */}
							<div className="border-t border-white/[0.04] p-4">
								<p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
									Quick Status
								</p>
								<div className="grid grid-cols-2 gap-2">
									{STATUS_OPTIONS.map((opt) => {
										const Icon = opt.icon;
										return (
											<button
												key={opt.label}
												type="button"
												onClick={() => handlePostStatus(opt.label)}
												className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white/70 transition hover:bg-white/5"
												style={{ border: "1px solid rgba(255,255,255,0.05)" }}
											>
												<Icon
													className="h-4 w-4 shrink-0"
													style={{ color: opt.color }}
												/>
												<span className="truncate text-xs">{opt.label}</span>
											</button>
										);
									})}
								</div>
							</div>
						</div>
					)}

					{/* Nearby active members — from Supabase */}
					{!showComposer && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400/70">
									NEARBY \u00b7 {geoState?.city ?? "Loading..."}
								</p>
								{nearbyUsers && nearbyUsers.length > 0 && (
									<button
										type="button"
										onClick={() => setShowMap(!showMap)}
										className={cn(
											"flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-all",
											showMap
												? "border-amber-500/30 bg-amber-500/10 text-amber-400"
												: "border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60",
										)}
										aria-pressed={showMap}
									>
										<Map className="size-3" />
										{showMap ? "List" : "Map"}
									</button>
								)}
							</div>

							{!nearbyUsers || nearbyUsers.length === 0 ? (
								<div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
									<p className="text-sm text-white/30">
										No one nearby right now. Check back in a bit.
									</p>
									<p className="mt-1 text-xs text-white/20">
										{geoState?.coords
											? `Location: ${geoState.city || "unknown city"}`
											: "Enable location to see who's around you"}
									</p>
								</div>
							) : showMap ? (
								<FYKMap
									pins={nearbyUsers.map((u): MapPinItem => ({
										id: u.id,
										lat: (geoState?.coords?.lat ?? 35.8989) + (Math.random() - 0.5) * 0.015,
										lng: (geoState?.coords?.lng ?? 14.5146) + (Math.random() - 0.5) * 0.015,
										label: u.name,
										photo: u.avatar || undefined,
										online: u.online,
									}))}
									userPosition={
										geoState?.coords
											? { lat: geoState.coords.lat, lng: geoState.coords.lng }
											: undefined
									}
									height={400}
								onSelect={() => {
									/* Could navigate to profile */
								}}
								/>
							) : (
								nearbyUsers.map((item) => (
									<div
										key={item.id}
										className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2 pr-3 transition-colors hover:bg-white/[0.04]"
									>
										<Link
											to="/profile/$profileId"
											params={{ profileId: item.id }}
											aria-label={`View ${item.name}'s profile`}
											className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10"
										>
											{item.avatar ? (
												<img
													src={item.avatar}
													alt=""
													className="size-full object-cover"
													loading="lazy"
												/>
											) : (
												<div className="flex size-full items-center justify-center bg-white/10 text-xs font-bold text-white/40">
													{item.name.charAt(0).toUpperCase()}
												</div>
											)}
											{item.online && (
												<span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-black bg-green-500" />
											)}
										</Link>
										<Link
											to="/profile/$profileId"
											params={{ profileId: item.id }}
											className="min-w-0 flex-1 rounded-lg px-1 py-2"
										>
											<div className="flex items-center gap-2">
												<p className="text-sm font-medium text-white/90">
													{item.name}
												</p>
												{item.online && (
													<span className="relative flex h-2 w-2">
														<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
														<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
													</span>
												)}
											</div>
											<p className="text-xs text-white/50">
												{item.status} \u00b7 {timeAgo(item.lastActiveAt)}
											</p>
										</Link>
										<div className="text-right">
											<Link
												to="/chat/$conversationId"
												params={{ conversationId: item.id }}
												className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400"
											>
												<MessageCircle className="size-3" /> Chat
											</Link>
										</div>
									</div>
								))
							)}
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
