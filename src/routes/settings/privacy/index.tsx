import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/privacy/')({
	component: PrivacySettingsPage,
});

function PrivacySettingsPage() {
	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<a href="/settings/account" className="text-muted-foreground hover:text-foreground">
					←
				</a>
				<h1 className="text-lg font-semibold">Privacy</h1>
			</div>
			<div className="flex flex-col gap-4 p-4">
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Show Distance</div>
						<div className="text-sm text-muted-foreground">
							Display your approximate distance to others
						</div>
					</div>
					<button className="h-6 w-11 rounded-full bg-primary/20 transition-colors">
						<div className="h-5 w-5 rounded-full bg-primary shadow-sm" />
					</button>
				</div>
			</div>
		</main>
	);
}
