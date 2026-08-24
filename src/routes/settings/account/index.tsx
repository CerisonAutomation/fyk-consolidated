import { requireAuth } from "#/domains/auth/guard";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/account/")({
	beforeLoad: requireAuth,
		component: AccountSettingsPage,
});

function AccountSettingsPage() {
	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<Link
					to="/settings"
					className="text-muted-foreground hover:text-foreground"
				>
					←
				</Link>
				<h1 className="text-lg font-semibold">Account</h1>
			</div>
			<div className="flex flex-col gap-2 p-4">
				<Link
					to="/settings/blocked"
					className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
				>
					<span>Blocked Users</span>
					<span className="text-muted-foreground">→</span>
				</Link>
				<Link
					to="/settings/hidden"
					className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
				>
					<span>Hidden Users</span>
					<span className="text-muted-foreground">→</span>
				</Link>
				<Link
					to="/settings/privacy"
					className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
				>
					<span>Privacy</span>
					<span className="text-muted-foreground">→</span>
				</Link>
			</div>
		</main>
	);
}
