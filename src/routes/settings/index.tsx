import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAuth } from "#/domains/auth/guard";
import { signOut } from "#/domains/auth/services/sign-out";
import { useAuthStore } from "#/domains/auth/store";

export const Route = createFileRoute("/settings/")({
	beforeLoad: requireAuth,
	component: SettingsPage,
});

function SettingsPage() {
	const { auth } = useAuthStore();

	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="flex w-full p-4 pb-20">
					<div className="m-auto flex w-full max-w-sm flex-col gap-3 pb-16">
						{/* Profile Link */}
						{auth?.userId && (
							<Link
								to="/profile/$profileId"
								params={{ profileId: auth.userId }}
								className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
							>
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
									{auth.userId.charAt(0)}
								</div>
								<div>
									<div className="font-medium">My Profile</div>
									<div className="text-sm text-muted-foreground">
										View and edit your profile
									</div>
								</div>
							</Link>
						)}

						<hr className="border-border" />

						{/* Account Settings */}
						<Link
							to="/settings/account"
							className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								&#x1F464;
							</div>
							<div>
								<div className="font-medium">Account</div>
								<div className="text-sm text-muted-foreground">
									Manage your account settings
								</div>
							</div>
						</Link>

						{/* Profile Edit */}
						<Link
							to="/settings/profile"
							className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								&#x270F;&#xFE0F;
							</div>
							<div>
								<div className="font-medium">Edit Profile</div>
								<div className="text-sm text-muted-foreground">
									Update your profile information
								</div>
							</div>
						</Link>

						{/* App Settings */}
						<Link
							to="/settings/app"
							className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								&#x2699;&#xFE0F;
							</div>
							<div>
								<div className="font-medium">App</div>
								<div className="text-sm text-muted-foreground">
									Notifications, units, and preferences
								</div>
							</div>
						</Link>

						{/* Privacy */}
						<Link
							to="/settings/privacy"
							className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								&#x1F512;
							</div>
							<div>
								<div className="font-medium">Privacy</div>
								<div className="text-sm text-muted-foreground">
									Show distance, online status, and visibility
								</div>
							</div>
						</Link>

						{/* Blocked Users */}
						<Link
							to="/settings/blocked"
							className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								&#x1F6AB;
							</div>
							<div>
								<div className="font-medium">Blocked Users</div>
								<div className="text-sm text-muted-foreground">
									Manage blocked profiles
								</div>
							</div>
						</Link>

						{/* Hidden Users */}
						<Link
							to="/settings/hidden"
							className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								&#x1F441;
							</div>
							<div>
								<div className="font-medium">Hidden Users</div>
								<div className="text-sm text-muted-foreground">
									Manage hidden profiles
								</div>
							</div>
						</Link>

						<button
							onClick={() => signOut()}
							className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 p-3 text-destructive transition-colors hover:bg-destructive/5"
						>
							Sign Out
						</button>

						<hr className="border-border" />

						<div className="px-4 py-2 text-center font-mono text-xs break-all whitespace-pre-wrap text-muted-foreground select-text">
							fyk-tanstack v0.1.0
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
