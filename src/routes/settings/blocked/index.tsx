import { requireAuth } from "#/domains/auth/guard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useBlockedUsers, useUnblockUser } from "#/core/api/hooks/use-blocks";
import { useProfiles } from "#/core/api/hooks/use-profiles";
import { UserAvatar } from "#/core/ui/molecules/UserAvatar";
import { showErrorToast } from "#/core/lib/error-toast";

export const Route = createFileRoute("/settings/blocked/")({
	beforeLoad: requireAuth,
	component: BlockedUsersPage,
});

function BlockedUsersPage() {
	const { data: blockedUsers = [], isLoading } = useBlockedUsers();
	const profileIds = blockedUsers.map((u) => u.profileId);
	const { data: profiles = [] } = useProfiles(profileIds);
	const unblockUser = useUnblockUser();

	const profileMap = new Map(
		profiles.map((p) => [p.profileId, p]),
	);

	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<Link to="/settings" className="text-muted-foreground hover:text-foreground">
					&larr;
				</Link>
				<h1 className="text-lg font-semibold">Blocked Users</h1>
			</div>
			{isLoading ? (
				<div className="flex flex-1 items-center justify-center p-6">
					<span className="text-center text-muted-foreground">Loading...</span>
				</div>
			) : blockedUsers.length === 0 ? (
				<div className="flex flex-1 items-center justify-center p-6">
					<span className="text-center text-muted-foreground">
						No blocked users
					</span>
				</div>
			) : (
				<div className="flex flex-col gap-2 p-4">
					{blockedUsers.map((blocked) => {
						const profile = profileMap.get(blocked.profileId);
						const displayName =
							(profile?.displayName as string | null) ??
							`User #${blocked.profileId}`;
						const mediaHash =
							(profile?.profileImageMediaHash as string | null) ?? null;

						return (
							<div
								key={blocked.profileId}
								className="flex items-center gap-3 rounded-lg border border-border p-3"
							>
								<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
									<UserAvatar
										mediaHash={mediaHash}
										className="size-full"
										size="md"
									/>
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate font-medium">
										{displayName}
									</div>
									<div className="text-xs text-muted-foreground">
										Blocked
									</div>
								</div>
								<button
									onClick={() =>
										unblockUser.mutate(
											{ profileId: blocked.profileId },
											{
												onError: (error) => {
													showErrorToast({
														label: "Failed to unblock user",
														error,
													});
												},
											},
										)
									}
									disabled={unblockUser.isPending}
									className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
								>
									Unblock
								</button>
							</div>
						);
					})}
				</div>
			)}
		</main>
	);
}
