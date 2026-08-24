import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/profile/')({
	component: ProfileEditPage,
});

function ProfileEditPage() {
	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<a href="/settings" className="text-muted-foreground hover:text-foreground">
					←
				</a>
				<h1 className="text-lg font-semibold">Edit Profile</h1>
			</div>
			<div className="flex flex-col gap-4 p-4">
				<p className="text-sm text-muted-foreground">
					Profile editing form will be wired to the API.
				</p>
				<div className="space-y-4">
					<div>
						<label className="mb-1 block text-sm font-medium">
							Display Name
						</label>
						<input
							type="text"
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="Your display name"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium">
							About Me
						</label>
						<textarea
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							rows={4}
							placeholder="Tell others about yourself"
						/>
					</div>
				</div>
			</div>
		</main>
	);
}
