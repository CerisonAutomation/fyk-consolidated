import { createFileRoute, Link } from "@tanstack/react-router";
import { useViews } from "#/core/api/hooks/use-views";
import { Eye, Heart, Lock } from "lucide-react";
import { resolveMediaUrl } from "#/integrations/supabase/media";

export const Route = createFileRoute("/interest/views/")({
	component: ViewsPage,
});

interface ViewerItem {
	profileId: number;
	displayName: string | null;
	/** The visitor's primary photo reference, straight from the card. */
	photo: string | null;
	onlineUntil: number | null;
	isSecretAdmirer: boolean;
	lastViewed: number | null;
}

const VIEW_SKELETON_IDS = ["one", "two", "three", "four", "five", "six"];

function ViewsPage() {
	const { data, isLoading } = useViews();
	const profiles = (data?.profiles ?? []) as unknown as ViewerItem[];
	const previews = (data?.previews ?? []) as unknown as ViewerItem[];

	const allViewers = [...profiles, ...previews].map((viewer, index) => ({
		...viewer,
		// Secret-admirer previews intentionally omit a public profile ID. Give
		// each card a stable, local-only identity so React can reconcile it.
		profileId: viewer.profileId ?? -(index + 1),
	}));
	const uniqueViewers = allViewers.reduce<ViewerItem[]>((acc, viewer) => {
		const id = viewer.profileId;
		if (!acc.some((v) => v.profileId === id)) {
			acc.push(viewer);
		}
		return acc;
	}, []);

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-lg px-4 py-4 pb-24">
					{/* Header */}
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h1 className="font-display text-xl font-semibold tracking-wide text-white">
								Who Viewed Me
							</h1>
							<p className="mt-0.5 text-xs text-white/40">
								{uniqueViewers.length === 0
									? "No viewers yet"
									: `${uniqueViewers.length} viewer${uniqueViewers.length === 1 ? "" : "s"}`}
							</p>
						</div>
					</div>

					{/* Content */}
					{isLoading ? (
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							{VIEW_SKELETON_IDS.map((id, i) => (
								<div
									key={id}
									className="aspect-[3/4] animate-pulse rounded-xl bg-white/5"
									style={{ animationDelay: `${i * 60}ms` }}
								/>
							))}
						</div>
					) : uniqueViewers.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-20">
							<div
								className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
								style={{
									background:
										"color-mix(in srgb, var(--accent-primary) 8%, transparent)",
								}}
							>
								<Eye className="h-10 w-10 text-amber-400/30" />
							</div>
							<h3 className="font-display text-lg text-white/60">
								No one has viewed you yet
							</h3>
							<p className="mt-1 max-w-xs text-center text-sm text-white/30">
								When someone views your profile, they'll appear here. Keep
								exploring!
							</p>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							{uniqueViewers.map((viewer) => (
								<ViewCard key={viewer.profileId} viewer={viewer} />
							))}
						</div>
					)}
				</div>
			</div>
		</main>
	);
}

function ViewCard({ viewer }: { viewer: ViewerItem }) {
	if (viewer.isSecretAdmirer) {
		return (
			<div className="group relative aspect-[3/4] overflow-hidden rounded-xl">
				<div
					className="flex h-full items-center justify-center"
					style={{
						background:
							"linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))",
						border: "1px solid rgba(236,72,153,0.15)",
					}}
				>
					<div className="flex flex-col items-center gap-2 text-center">
						<div
							className="flex h-12 w-12 items-center justify-center rounded-full"
							style={{ background: "rgba(236,72,153,0.15)" }}
						>
							<Heart className="h-6 w-6 text-pink-400" fill="currentColor" />
						</div>
						<span className="text-sm font-medium text-white/80">
							Secret Admirer
						</span>
						<Lock className="h-3 w-3 text-white/30" />
					</div>
				</div>
				{viewer.lastViewed !== null && (
					<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
						<span className="text-[10px] text-white/60">
							{formatTimeAgo(viewer.lastViewed)}
						</span>
					</div>
				)}
			</div>
		);
	}

	const isOnline =
		viewer.onlineUntil !== null && viewer.onlineUntil > Date.now();
	const photoUrl = resolveMediaUrl(viewer.photo);

	return (
		<Link
			to="/profile/$profileId"
			params={{ profileId: String(viewer.profileId) }}
			className="group relative aspect-[3/4] overflow-hidden rounded-xl"
			style={{ border: "1px solid rgba(255,255,255,0.06)" }}
		>
			{photoUrl ? (
				<img
					src={photoUrl}
					alt={viewer.displayName ?? "Profile viewer"}
					className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
				/>
			) : (
				<div className="flex h-full items-center justify-center bg-gold/10 text-3xl font-bold text-gold">
					{viewer.displayName?.charAt(0) ?? "?"}
				</div>
			)}
			<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 pt-6">
				<p className="text-sm font-medium text-white drop-shadow-md">
					{viewer.displayName ?? "Someone"}
				</p>
				{viewer.lastViewed !== null && (
					<p className="mt-0.5 text-[10px] text-white/60">
						{formatTimeAgo(viewer.lastViewed)}
					</p>
				)}
			</div>
			{isOnline && (
				<div
					className="absolute right-2 top-2 h-3 w-3 rounded-full bg-green-500 ring-2 ring-black/30"
					title="Online now"
				/>
			)}
			<div className="absolute left-2 top-2 opacity-0 transition group-hover:opacity-100">
				<span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-[10px]">
					<Eye className="h-3 w-3 text-white/70" />
				</span>
			</div>
		</Link>
	);
}

function formatTimeAgo(ts: number): string {
	const seconds = Math.floor((Date.now() - ts) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
