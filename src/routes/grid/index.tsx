import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, MessageCircle, MapPin, RefreshCw, ShieldAlert, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { api, ApiClientError } from "#/lib/client";
import type { DiscoverPage, PublicProfile, TapResult } from "#/lib/api-types";
import { timeAgo } from "#/lib/utils";
import { Avatar } from "#/components/ui/Avatar";
import { Chip } from "#/components/ui/Chip";
import { MediaImage } from "#/components/ui/MediaImage";
import { PullToRefresh } from "#/components/ui/PullToRefresh";
import { StateBlock, describeFailure } from "#/components/ui/StateBlock";
import { ReportDialog } from "#/components/ReportDialog";
import { useShell } from "#/components/AppShell";

export const Route = createFileRoute("/grid/")({
	component: NearbyPage,
	head: () => ({ meta: [{ title: "Nearby — FYK" }] }),
});

type Filters = {
	maxKm: number;
	onlineOnly: boolean;
	openToMeet: boolean;
	hasPhotos: boolean;
	ageMin: number | null;
	ageMax: number | null;
	exposure: "clean" | "mature";
	lookingFor: string[];
};

const DEFAULT_FILTERS: Filters = { maxKm: 25, onlineOnly: false, openToMeet: false, hasPhotos: false, ageMin: null, ageMax: null, exposure: "clean", lookingFor: [] };
const FILTER_KEY = "fyk:nearby-filters";

function readFilters(): Filters {
	try {
		const raw = localStorage.getItem(FILTER_KEY);
		return raw ? { ...DEFAULT_FILTERS, ...(JSON.parse(raw) as Partial<Filters>) } : DEFAULT_FILTERS;
	} catch {
		return DEFAULT_FILTERS;
	}
}

function NearbyPage() {
	const { session, capable } = useShell();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [filters, setFilters] = useState<Filters>(readFilters);
	const [page, setPage] = useState(0);
	const [showFilters, setShowFilters] = useState(false);
	const [reportTarget, setReportTarget] = useState<PublicProfile | null>(null);
	const [matched, setMatched] = useState<{ profile: PublicProfile; conversationId: string | null } | null>(null);
	const [localError, setLocalError] = useState("");

	useEffect(() => {
		try {
			localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
		} catch {
			// Private-mode browsers throw on storage; filters simply will not persist.
		}
	}, [filters]);

	const query = useMemo(() => {
		const params = new URLSearchParams({ page: String(page) });
		if (filters.maxKm !== DEFAULT_FILTERS.maxKm) params.set("maxKm", String(filters.maxKm));
		if (filters.onlineOnly) params.set("onlineOnly", "true");
		if (filters.openToMeet) params.set("openToMeet", "true");
		if (filters.hasPhotos) params.set("hasPhotos", "true");
		if (filters.ageMin) params.set("ageMin", String(filters.ageMin));
		if (filters.ageMax) params.set("ageMax", String(filters.ageMax));
		if (filters.lookingFor.length) params.set("lookingFor", filters.lookingFor.join(","));
		if (filters.exposure !== "clean") params.set("exposure", filters.exposure);
		return params.toString();
	}, [filters, page]);

	const { data, isPending, error, refetch, isFetching } = useQuery({
		queryKey: ["discover", query],
		queryFn: () => api.get<DiscoverPage>(`discover?${query}`),
		enabled: capable("discovery"),
		staleTime: 20_000,
	});

	const tap = useMutation({
		mutationFn: ({ targetId, action }: { targetId: string; action: "tap" | "pass" | "favorite" }) => api.post<TapResult>("taps", { targetId, action }),
		onSuccess: (result, variables) => {
			void queryClient.invalidateQueries({ queryKey: ["discover"] });
			void queryClient.invalidateQueries({ queryKey: ["conversations"] });
			if (!result.matched) return;
			const target = data?.candidates.find((candidate) => candidate.id === variables.targetId) ?? null;
			// The conversation id comes from the server's own read-back of the row its
			// trigger created — never from a client-side guess.
			if (target) setMatched({ profile: target, conversationId: result.conversationId });
		},
		onError: (err) => {
			// A rejection here is a real product signal (rate limit, block), so it is
			// shown inline rather than as a toast that disappears.
			setLocalError(err instanceof ApiClientError ? err.message : "That tap did not save. Try again.");
		},
	});

	const candidates = data?.candidates ?? [];
	const failure = error ? describeFailure(error) : null;

	if (!capable("discovery")) {
		return <StateBlock kind="disabled" title="Nearby is unavailable" description="The profiles table is not readable for your account, so there is nothing to list. Re-run the migrations in supabase/migrations and reload." />;
	}

	return (
		<>
			<PullToRefresh onRefresh={async () => { await refetch(); }}>
				<div className="mb-3 flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowFilters((value) => !value)}
						aria-expanded={showFilters}
						className={chipClass(showFilters)}
					>
						<SlidersHorizontal className="h-3.5 w-3.5" />
						Filters
						{activeFilterCount(filters) > 0 && <span className="ml-0.5 rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">{activeFilterCount(filters)}</span>}
					</button>
					<button type="button" onClick={() => void refetch()} className={chipClass(isFetching)} aria-label="Refresh nearby profiles">
						<RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
					</button>
					<span className="ml-auto text-[12px] text-faint">
						{data ? `${candidates.length} nearby` : "…"}
					</span>
				</div>

				{showFilters && (
					<div className="anim-expand mb-4 rounded-2xl border border-line bg-surface p-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold text-ink-2">
									Distance <span className="font-normal text-gold">≤ {filters.maxKm} km</span>
								</span>
								<input type="range" min={1} max={200} value={filters.maxKm} onChange={(event) => setFilters({ ...filters, maxKm: Number(event.target.value) })} className="w-full accent-[var(--color-gold)]" />
								<span className="mt-1 block text-[11px] leading-snug text-faint">
									Distance is measured from a ~250 m square, so it is approximate on purpose.
								</span>
							</label>

							<div>
								<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Age range</span>
								<div className="flex items-center gap-2">
									<input type="number" min={18} max={99} placeholder="Any" value={filters.ageMin ?? ""} onChange={(event) => setFilters({ ...filters, ageMin: event.target.value ? Number(event.target.value) : null })} className="entry-input h-10 flex-1" />
									<span className="text-faint">–</span>
									<input type="number" min={18} max={99} placeholder="Any" value={filters.ageMax ?? ""} onChange={(event) => setFilters({ ...filters, ageMax: event.target.value ? Number(event.target.value) : null })} className="entry-input h-10 flex-1" />
								</div>
							</div>
						</div>

						<div className="mt-4 flex flex-wrap gap-2">
							<Chip active={filters.onlineOnly} onClick={() => setFilters({ ...filters, onlineOnly: !filters.onlineOnly })}>Online now</Chip>
							<Chip active={filters.openToMeet} onClick={() => setFilters({ ...filters, openToMeet: !filters.openToMeet })} tone="live">Open to meet</Chip>
							<Chip active={filters.hasPhotos} onClick={() => setFilters({ ...filters, hasPhotos: !filters.hasPhotos })}>With photos</Chip>
							<Chip active={filters.exposure === "mature"} onClick={() => setFilters({ ...filters, exposure: filters.exposure === "clean" ? "mature" : "clean" })} tone="violet">Mature profiles</Chip>
							{["dating", "friends", "relationship", "hookup"].map((intent) => (
								<Chip
									key={intent}
									active={filters.lookingFor.includes(intent)}
									onClick={() => setFilters({ ...filters, lookingFor: filters.lookingFor.includes(intent) ? filters.lookingFor.filter((entry) => entry !== intent) : [...filters.lookingFor, intent] })}
								>
									{intent}
								</Chip>
							))}
							<button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="ml-auto text-[12px] text-muted hover:text-ink">
								Clear all
							</button>
						</div>
					</div>
				)}

				{localError && (
					<p role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] text-live">
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {localError}
					</p>
				)}

				{isPending ? (
					<GridSkeleton />
				) : failure ? (
					<StateBlock
						kind="error"
						title="Nearby could not load"
						description={failure.message}
						action={
							<button type="button" onClick={() => void refetch()} className="press flex h-11 items-center gap-2 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black">
								<RefreshCw className="h-4 w-4" /> Try again
							</button>
						}
					/>
				) : candidates.length === 0 ? (
					<StateBlock
						kind="empty"
						title={data?.note ?? "Nobody nearby yet"}
						description={session.self ? "We search the area around your coarse location. Widen the distance or clear a filter." : "Add a location in Settings so FYK knows which area to search."}
						action={
							<button type="button" onClick={() => (session.self ? setFilters(DEFAULT_FILTERS) : void navigate({ to: "/settings" }))} className="press flex h-11 items-center gap-2 rounded-full border border-gold/50 bg-gold-ghost px-4 text-[13.5px] font-bold text-gold">
								<MapPin className="h-4 w-4" /> {session.self ? "Reset filters" : "Set my area"}
							</button>
						}
					/>
				) : (
					<>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
							{candidates.map((candidate, index) => (
								<NearbyCard
									key={candidate.id}
									profile={candidate}
								busy={tap.isPending && tap.variables?.targetId === candidate.id}
									onOpen={() => void navigate({ to: "/profile/$profileId", params: { profileId: candidate.id } })}
									onTap={() => {
										setLocalError("");
										tap.mutate({ targetId: candidate.id, action: "tap" });
									}}
									onPass={() => tap.mutate({ targetId: candidate.id, action: "pass" })}
									onReport={() => setReportTarget(candidate)}
									priority={index < 4}
								/>
							))}
						</div>

						<div className="mt-5 flex items-center justify-center gap-3">
							{page > 0 && (
								<button type="button" onClick={() => setPage(page - 1)} className="press h-11 rounded-full border border-line px-4 text-[13px] font-semibold text-ink-2">
									Previous
								</button>
							)}
							<span className="text-[12.5px] text-faint">Page {page + 1}</span>
							{data?.hasMore ? (
								<button type="button" onClick={() => setPage(page + 1)} className="press h-11 rounded-full border border-line px-4 text-[13px] font-semibold text-ink-2">
									More
								</button>
							) : (
								<span className="text-[12.5px] text-faint">That's everyone in this area</span>
							)}
						</div>
					</>
				)}
			</PullToRefresh>

			{matched && (
				<MatchSheet
					profile={matched.profile}
					onClose={() => setMatched(null)}
					onMessage={() => {
						const conversationId = matched.conversationId;
						setMatched(null);
						// No conversation yet (the trigger can lag a moment) means we go to the
						// list, which will show it once it exists — never a fake thread.
						if (conversationId) void navigate({ to: "/chat/$conversationId", params: { conversationId } });
						else void navigate({ to: "/chat" });
					}}
				/>
			)}

			{reportTarget && <ReportDialog targetType="profile" targetId={reportTarget.id} targetLabel={reportTarget.displayName} onClose={() => setReportTarget(null)} />}
		</>
	);
}

function chipClass(active: boolean) {
	return `press flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors ${active ? "border-gold/60 bg-gold-ghost text-gold" : "border-line bg-surface text-ink-2 hover:text-ink"}`;
}

function activeFilterCount(filters: Filters) {
	let count = 0;
	if (filters.maxKm !== DEFAULT_FILTERS.maxKm) count += 1;
	if (filters.onlineOnly) count += 1;
	if (filters.openToMeet) count += 1;
	if (filters.hasPhotos) count += 1;
	if (filters.exposure !== "clean") count += 1;
	if (filters.ageMin || filters.ageMax) count += 1;
	count += filters.lookingFor.length;
	return count;
}

function NearbyCard({
	profile,
	busy,
	onOpen,
	onTap,
	onPass,
	onReport,
	priority,
}: {
	profile: PublicProfile;
	busy: boolean;
	onOpen: () => void;
	onTap: () => void;
	onPass: () => void;
	onReport: () => void;
	priority: boolean;
}) {
	const photo = profile.photos[0];
	return (
		<article className="group relative overflow-hidden rounded-2xl border border-line bg-surface">
			<button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${profile.displayName}'s profile`}>
				<div className="relative">
					{photo ? (
						<MediaImage src={photo.url} alt="" ratio="3 / 4" priority={priority} className="w-full" label={`${profile.displayName}'s photo is unavailable`} />
					) : (
						<div className="flex aspect-[3/4] w-full items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--color-gold-ghost),transparent)]">
							<Avatar name={profile.displayName} photoUrl={profile.avatarUrl} size={64} online={profile.presence === "online"} />
						</div>
					)}
					<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent" />
					<div className="absolute inset-x-0 bottom-0 p-3">
						<div className="flex items-end justify-between gap-2">
							<div className="min-w-0">
								<p className="truncate text-[14px] font-bold leading-tight text-white">
									{profile.displayName}, {profile.age ?? "—"}
								</p>
								<p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-white/70">
									{profile.distanceLabel ? (
										<>
											<MapPin className="h-3 w-3" /> {profile.distanceLabel}
										</>
									) : (
										profile.city ?? "Somewhere"
									)}
								</p>
							</div>
							{profile.openToMeet ? <span className="shrink-0 rounded-full bg-live/90 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-black">Free</span> : null}
						</div>
					</div>
				</div>
			</button>

			<div className="flex items-center gap-1.5 border-t border-line-soft px-2.5 py-2">
				<span className={`inline-flex items-center gap-1 text-[10.5px] font-medium ${profile.presence === "online" ? "text-emerald-400" : "text-faint"}`}>
					<span className={`h-1.5 w-1.5 rounded-full ${profile.presence === "online" ? "bg-emerald-400" : "bg-white/25"}`} />
					{profile.presence === "online" ? "Online" : profile.presence === "active" ? "Active" : timeAgo(profile.lastActiveAt)}
				</span>
				<div className="ml-auto flex items-center gap-1">
					<button type="button" onClick={onPass} className="press grid h-8 w-8 place-items-center rounded-full border border-line text-muted hover:text-ink" aria-label={`Skip ${profile.displayName}`}>
						<X className="h-4 w-4" />
					</button>
					<button type="button" onClick={onTap} disabled={busy} className="press flex h-8 items-center gap-1 rounded-full bg-gold px-2.5 text-[11.5px] font-bold text-black disabled:opacity-60" aria-label={`Tap ${profile.displayName}`}>
						<Sparkles className="h-3.5 w-3.5" />
						{busy ? "…" : "Tap"}
					</button>
					<button type="button" onClick={onReport} className="press grid h-8 w-8 place-items-center rounded-full text-faint hover:text-live" aria-label={`Report ${profile.displayName}`}>
						<ShieldAlert className="h-4 w-4" />
					</button>
				</div>
			</div>
		</article>
	);
}

function GridSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
			{Array.from({ length: 8 }).map((_, index) => (
				<div key={index} className="skeleton aspect-[3/4] rounded-2xl" />
			))}
		</div>
	);
}

/**
 * A match celebration only renders when the server said `matched`, which it
 * derives from the row its own trigger created. It cannot be triggered locally.
 */
function MatchSheet({ profile, onClose, onMessage }: { profile: PublicProfile | null; onClose: () => void; onMessage: () => void }) {
	const card = profile;
	const closeRef = useRef(onClose);
	closeRef.current = onClose;
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeRef.current();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	if (!card) return null;
	return (
		<div role="dialog" aria-modal="true" aria-label={`You and ${card.displayName} matched`} className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-5 backdrop-blur-sm">
			<div className="anim-sheet w-full max-w-sm rounded-3xl border border-gold/25 bg-surface p-6 text-center">
				<p className="text-[11px] font-bold uppercase tracking-[0.28em] text-gold">It's a match</p>
				<div className="my-5 flex items-center justify-center gap-3">
					<Avatar name={card.displayName} photoUrl={card.avatarUrl} size={72} />
					<span className="text-2xl text-gold">♥</span>
					<span className="grid h-[72px] w-[72px] place-items-center rounded-full border border-line bg-surface-2 text-[24px] font-bold text-gold">{(card.handle ?? "F").slice(0, 1).toUpperCase()}</span>
				</div>
				<p className="text-[15px] leading-relaxed text-ink">
					You and <span className="font-semibold">{card.displayName}</span> tapped each other.
				</p>
				<p className="mt-1.5 text-[13px] text-muted">Say something first — no auto opener, and no prompt pretending to be one.</p>
				<div className="mt-6 space-y-2">
					<button type="button" onClick={onMessage} className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black">
						<MessageCircle className="h-4 w-4" /> Say something
					</button>
					<button type="button" onClick={onClose} className="press h-11 w-full rounded-full border border-line text-[13.5px] font-semibold text-ink-2">
						Keep browsing
					</button>
				</div>
			</div>
		</div>
	);
}

