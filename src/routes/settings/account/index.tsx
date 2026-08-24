import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/account/')({
	component: AccountSettingsPage,
});

function AccountSettingsPage() {
	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<a href="/settings" className="text-muted-foreground hover:text-foreground">
					←
				</a>
				<h1 className="text-lg font-semibold">Account</h1>
			</div>
			<div className="flex flex-col gap-2 p-4">
				<a
					href="/settings/account/blocked"
					className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
				>
					<span>Blocked Users</span>
					<span className="text-muted-foreground">→</span>
				</a>
				<a
					href="/settings/account/hidden"
					className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
				>
					<span>Hidden Users</span>
					<span className="text-muted-foreground">→</span>
				</a>
				<a
					href="/settings/account/privacy"
					className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
				>
					<span>Privacy</span>
					<span className="text-muted-foreground">→</span>
				</a>
			</div>
		</main>
	);
}
