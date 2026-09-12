import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ShieldOff, UserCircle } from "lucide-react";
import { useBlockedUsers, useUnblockUser } from "#/core/api/hooks/use-blocks";
import { useProfiles } from "#/core/api/hooks/use-profiles";
import { requireDocumentSession } from "#/lib/document-auth";

export const Route = createFileRoute("/settings/blocked/")({
	// AUDIT §3.3: a private screen must not be rendered for a request that carries no
	// session. `requireDocumentSession` is the isomorphic guard — its client branch is
	// a no-op, because a browser has no credential to inspect and `/api/*` verifies
	// every request and 401s without one; its server branch is the redirect.
	beforeLoad: async () => {
		await requireDocumentSession();
	},
	component: BlockedUsersPage,
});

interface BlockedUser {
	profileId: string;
	displayName: string;
	avatar?: string;
	blockedAt: Date;
}

function BlockedUsersPage() {
	const blockedQuery = useBlockedUsers();
	const profileIds = blockedQuery.data?.map((user) => user.profileId) ?? [];
	const profilesQuery = useProfiles(profileIds);
	const unblock = useUnblockUser();
	const blockedUsers: BlockedUser[] = (blockedQuery.data ?? []).map(
		(blocked) => {
			const profile = profilesQuery.data?.find(
				(item) => item.profileId === blocked.profileId,
			);
			return {
				profileId: blocked.profileId,
				displayName:
					typeof profile?.displayName === "string"
						? profile.displayName
						: "Anonymous",
				blockedAt: new Date(blocked.blockedTime),
			};
		},
	);

	const handleUnblock = (profileId: string) => {
		unblock.mutate({ profileId });
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
								Blocked Users
							</h1>
							<p className="mt-0.5 text-xs text-white/40">
								{blockedUsers.length === 0
									? "No blocked users"
									: `${blockedUsers.length} blocked`}
							</p>
						</div>
					</div>

					{blockedQuery.isLoading || profilesQuery.isLoading ? (
						<div className="flex justify-center py-20">
							<div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/20 border-t-amber-400" />
						</div>
					) : blockedQuery.error ? (
						<p className="py-16 text-center text-sm text-red-400">
							Could not load blocked users. Please try again.
						</p>
					) : blockedUsers.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-20">
							<div
								className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
								style={{
									background:
										"color-mix(in srgb, var(--accent-primary) 8%, transparent)",
								}}
							>
								<ShieldOff className="h-10 w-10 text-amber-400/30" />
							</div>
							<h3 className="font-display text-lg text-white/60">
								No blocked users
							</h3>
							<p className="mt-1 max-w-xs text-center text-sm text-white/30">
								People you block won't be able to see your profile or send you
								messages.
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{blockedUsers.map((user) => (
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
											Blocked {user.blockedAt.toLocaleDateString()}
										</p>
									</div>
									<button
										type="button"
										onClick={() => handleUnblock(user.profileId)}
										disabled={unblock.isPending}
										className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition hover:bg-amber-500/20"
									>
										Unblock
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
