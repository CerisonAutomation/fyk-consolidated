import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/app/')({
	component: AppSettingsPage,
});

function AppSettingsPage() {
	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<a href="/settings" className="text-muted-foreground hover:text-foreground">
					←
				</a>
				<h1 className="text-lg font-semibold">App Settings</h1>
			</div>
			<div className="flex flex-col gap-4 p-4">
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Stay Online</div>
						<div className="text-sm text-muted-foreground">
							Appear online even when app is in background
						</div>
					</div>
					<button className="h-6 w-11 rounded-full bg-primary/20 transition-colors">
						<div className="h-5 w-5 rounded-full bg-primary shadow-sm" />
					</button>
				</div>
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Reveal Message Read</div>
						<div className="text-sm text-muted-foreground">
							Show when your messages have been read
						</div>
					</div>
					<button className="h-6 w-11 rounded-full bg-primary/20 transition-colors">
						<div className="h-5 w-5 rounded-full bg-primary shadow-sm" />
					</button>
				</div>
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Reveal Profile Views</div>
						<div className="text-sm text-muted-foreground">
							Show when others view your profile
						</div>
					</div>
					<button className="h-6 w-11 rounded-full bg-primary/20 transition-colors">
						<div className="h-5 w-5 rounded-full bg-primary shadow-sm" />
					</button>
				</div>
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Units</div>
						<div className="text-sm text-muted-foreground">
							Choose between metric and imperial
						</div>
					</div>
					<select className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
						<option value="metric">Metric</option>
						<option value="imperial">Imperial</option>
					</select>
				</div>
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Auto-Update Location</div>
						<div className="text-sm text-muted-foreground">
							Automatically update your location
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
