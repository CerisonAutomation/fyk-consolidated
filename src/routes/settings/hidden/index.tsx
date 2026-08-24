import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/hidden/')({
	component: HiddenUsersPage,
});

function HiddenUsersPage() {
	return (
		<main className="screen-nav-host">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<a href="/settings/account" className="text-muted-foreground hover:text-foreground">
					←
				</a>
				<h1 className="text-lg font-semibold">Hidden Users</h1>
			</div>
			<div className="flex flex-1 items-center justify-center p-6">
				<span className="text-center text-muted-foreground">
					No hidden users
				</span>
			</div>
		</main>
	);
}
