import { createFileRoute, Link } from "@tanstack/react-router";
import { useViews } from "#/core/api/hooks/use-views";
import { UserAvatar } from "#/core/ui/molecules/UserAvatar";
import { RelativeTimeDynamic } from "#/core/ui/molecules/RelativeTimeDynamic";
import { Eye, Heart } from "lucide-react";

export const Route = createFileRoute("/interest/views/")({
	component: ViewsPage,
});

interface ViewerItem {
	profileId: number;
	displayName: string | null;
	profileImageMediaHash: string | null;
	onlineUntil: number | null;
	isSecretAdmirer: boolean;
	lastViewed: number | null;
}

function ViewsPage() {
	const { data, isLoading } = useViews();
	const profiles = (data?.profiles ?? []) as unknown as ViewerItem[];
	const previews = (data?.previews ?? []) as unknown as ViewerItem[];

	// Combine profiles and previews, deduplicate by profileId
	const allViewers = [...profiles, ...previews];
	const uniqueViewers = allViewers.reduce<ViewerItem[]>((acc, viewer) => {
		const id = viewer.profileId ?? 0;
		if (!acc.some((v) => v.profileId === id)) {
			acc.push(viewer);
		}
		return acc;
	}, []);

	return (
		<main className="screen-nav-host">
			<div className="flex items-center justify-between px-4 py-2">
				<h1 className="text-lg font-semibold">Who Viewed Me</h1>
				{uniqueViewers.length > 0 && (
					<span className="text-sm text-muted-foreground">
						{uniqueViewers.length} {uniqueViewers.length === 1 ? "viewer" : "viewers"}
					</span>
				)}
			</div>

			{isLoading ? (
				<div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 md:grid-cols-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<div
							key={i}
							className="aspect-[3/4] animate-pulse rounded-lg bg-muted"
						/>
					))}
				</div>
			) : uniqueViewers.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<div className="flex size-16 items-center justify-center rounded-full bg-muted">
						<Eye className="size-8 text-muted-foreground" />
					</div>
					<div className="text-center">
						<h2 className="text-lg font-semibold">No one has viewed your profile yet</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							When someone views your profile, they will appear here.
						</p>
					</div>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 md:grid-cols-4">
					{uniqueViewers.map((viewer) => (
						<ViewCard key={viewer.profileId} viewer={viewer} />
					))}
				</div>
			)}
		</main>
	);
}

function ViewCard({ viewer }: { viewer: ViewerItem }) {
	if (viewer.isSecretAdmirer) {
		return (
			<div className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
				<div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-500/20 to-purple-500/20">
					<div className="flex flex-col items-center gap-2 text-center">
						<div className="flex size-12 items-center justify-center rounded-full bg-pink-500/20">
							<Heart className="size-6 text-pink-500" fill="currentColor" />
						</div>
						<span className="text-sm font-medium text-foreground">
							Secret Admirer
						</span>
					</div>
				</div>
				{viewer.lastViewed !== null && (
					<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
						<span className="text-xs text-white/80">
							<RelativeTimeDynamic date={viewer.lastViewed / 1000} />
						</span>
					</div>
				)}
			</div>
		);
	}

	return (
		<Link
			to="/profile/$profileId"
			params={{ profileId: String(viewer.profileId) }}
			className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-muted"
		>
			<UserAvatar
				mediaHash={viewer.profileImageMediaHash}
				className="size-full"
				size="xl"
			/>
			<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2 pt-6">
				<span className="text-sm font-medium text-white drop-shadow-md">
					{viewer.displayName ?? "Someone"}
				</span>
				{viewer.lastViewed !== null && (
					<div className="mt-0.5">
						<span className="text-xs text-white/70">
							<RelativeTimeDynamic date={viewer.lastViewed / 1000} />
						</span>
					</div>
				)}
			</div>
			{viewer.onlineUntil !== null && viewer.onlineUntil > Date.now() / 1000 && (
				<div
					className="absolute right-2 top-2 h-3 w-3 rounded-full bg-green-500 ring-2 ring-black/20"
					title="Online now"
				/>
			)}
		</Link>
	);
}
