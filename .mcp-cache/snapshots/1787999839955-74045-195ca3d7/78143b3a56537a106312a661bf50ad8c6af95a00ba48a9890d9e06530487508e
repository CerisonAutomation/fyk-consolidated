import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, EyeOff, UserCircle } from "lucide-react";
import { useHiddenUsers, useUnhideUser } from "#/core/api/hooks/use-hides";
import { useProfiles } from "#/core/api/hooks/use-profiles";

export const Route = createFileRoute("/settings/hidden/")({
	component: HiddenUsersPage,
});

interface HiddenUser {
	profileId: number;
	displayName: string;
	avatar?: string;
	hiddenAt: Date;
}

function HiddenUsersPage() {
	const hiddenQuery = useHiddenUsers();
	const profileIds = hiddenQuery.data?.map((user) => user.profileId) ?? [];
	const profilesQuery = useProfiles(profileIds);
	const unhide = useUnhideUser();
	const hiddenUsers: HiddenUser[] = profileIds.map((profileId) => {
		const profile = profilesQuery.data?.find(
			(item) => item.profileId === profileId,
		);
		return {
			profileId,
			displayName:
				typeof profile?.displayName === "string"
					? profile.displayName
					: "Anonymous",
			hiddenAt: new Date(),
		};
	});

	const handleUnhide = (profileId: number) => {
		unhide.mutate({ profileId });
	};

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-lg px-4 py-4 pb-24">
					<div className="mb-6 flex items-center gap-3">
						<Link
							to="/settings/account"
							className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50 transition hover:bg-white/10"
						>
							<ChevronLeft className="h-5 w-5" />
						</Link>
						<div>
							<h1 className="font-display text-xl font-semibold tracking-wide text-white">
								Hidden Users
							</h1>
							<p className="mt-0.5 text-xs text-white/40">
								{hiddenUsers.length === 0
									? "No hidden users"
									: `${hiddenUsers.length} hidden`}
							</p>
						</div>
					</div>

					{hiddenQuery.isLoading || profilesQuery.isLoading ? (
						<div className="flex justify-center py-20">
							<div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/20 border-t-amber-400" />
						</div>
					) : hiddenQuery.error ? (
						<p className="py-16 text-center text-sm text-red-400">
							Could not load hidden users. Please try again.
						</p>
					) : hiddenUsers.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-20">
							<div
								className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
								style={{
									background:
										"color-mix(in srgb, var(--accent-primary) 8%, transparent)",
								}}
							>
								<EyeOff className="h-10 w-10 text-amber-400/30" />
							</div>
							<h3 className="font-display text-lg text-white/60">
								No hidden users
							</h3>
							<p className="mt-1 max-w-xs text-center text-sm text-white/30">
								Hidden profiles won't appear in your grid. You can unhide them
								here.
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{hiddenUsers.map((user) => (
								<div
									key={user.profileId}
									className="glass-card flex items-center gap-3 px-4 py-3"
								>
									<div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
										<UserCircle className="h-6 w-6 text-white/30" />
									</div>
									<div className="min-w-0 flex-1">
										<p className="font-medium text-white/90">
											{user.displayName}
										</p>
										<p className="text-xs text-white/40">
											Hidden {user.hiddenAt.toLocaleDateString()}
										</p>
									</div>
									<button
										type="button"
										onClick={() => handleUnhide(user.profileId)}
										disabled={unhide.isPending}
										className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20"
									>
										Unhide
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
