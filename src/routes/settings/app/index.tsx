import { requireAuth } from "#/domains/auth/guard";
import { createFileRoute, Link } from '@tanstack/react-router';
import { usePreferences } from '#/domains/settings/use-preferences';
import { Switch } from '#/components/ui/switch';

export const Route = createFileRoute('/settings/app/')({
	beforeLoad: requireAuth,
		component: AppSettingsPage,
});

function AppSettingsPage() {
	const { prefs, update, pending } = usePreferences();

	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<Link to="/settings" className="text-muted-foreground hover:text-foreground">
					←
				</Link>
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
					<Switch
						checked={prefs.stayOnline}
						disabled={pending}
						onCheckedChange={(checked) => update({ stayOnline: checked })}
					/>
				</div>
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Reveal Message Read</div>
						<div className="text-sm text-muted-foreground">
							Show when your messages have been read
						</div>
					</div>
					<Switch
						checked={prefs.revealMessageRead}
						disabled={pending}
						onCheckedChange={(checked) => update({ revealMessageRead: checked })}
					/>
				</div>
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Reveal Profile Views</div>
						<div className="text-sm text-muted-foreground">
							Show when others view your profile
						</div>
					</div>
					<Switch
						checked={prefs.revealProfileViews}
						disabled={pending}
						onCheckedChange={(checked) => update({ revealProfileViews: checked })}
					/>
				</div>
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Units</div>
						<div className="text-sm text-muted-foreground">
							Choose between metric and imperial
						</div>
					</div>
					<select
						value={prefs.units}
						disabled={pending}
						onChange={(e) =>
							update({ units: e.target.value as 'metric' | 'imperial' })
						}
						className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
					>
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
					<Switch
						checked={prefs.autoUpdateLocation}
						disabled={pending}
						onCheckedChange={(checked) => update({ autoUpdateLocation: checked })}
					/>
				</div>
			</div>
		</main>
	);
}
