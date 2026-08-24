import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/right-now/')({
	component: RightNowPage,
});

function RightNowPage() {
	return (
		<main className="screen-nav-host">
			<div className="flex items-center justify-between px-4 py-2">
				<h1 className="text-lg font-semibold">Right Now</h1>
			</div>
			<div className="flex flex-1 px-8">
				<div className="m-auto w-full max-w-sm rounded-lg border border-border p-6 text-center">
					<div className="mb-4 text-4xl">🚧</div>
					<h2 className="mb-2 text-lg font-semibold">Coming Soon</h2>
					<p className="text-sm text-muted-foreground">
						The "Right Now" feature is under development. Check back later!
					</p>
				</div>
			</div>
		</main>
	);
}
