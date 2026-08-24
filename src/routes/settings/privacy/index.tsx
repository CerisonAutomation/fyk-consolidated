import { requireAuth } from "#/domains/auth/guard";
import { createFileRoute, Link } from '@tanstack/react-router';
import { usePreferences } from '#/domains/settings/use-preferences';
import { Switch } from '#/components/ui/switch';

export const Route = createFileRoute('/settings/privacy/')({
	beforeLoad: requireAuth,
		component: PrivacySettingsPage,
});

function PrivacySettingsPage() {
	const { prefs, update, pending } = usePreferences();

	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<Link to="/settings" className="text-muted-foreground hover:text-foreground">
					←
				</Link>
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
					<Switch
						checked={prefs.showDistance}
						disabled={pending}
						onCheckedChange={(checked) => update({ showDistance: checked })}
					/>
				</div>
				<div className="flex items-center justify-between">
					<div>
						<div className="font-medium">Show Online Status</div>
						<div className="text-sm text-muted-foreground">
							Show when you are online to others
						</div>
					</div>
					<Switch
						checked={prefs.showOnlineStatus}
						disabled={pending}
						onCheckedChange={(checked) => update({ showOnlineStatus: checked })}
					/>
				</div>
			</div>
		</main>
	);
}
