import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/interest/views/')({
	component: ViewsPage,
});

function ViewsPage() {
	const [views] = useState<Array<{
		profileId: number;
		displayName: string | null;
		lastViewed: number;
		isSecretAdmirer: boolean;
		viewedCount: { totalCount: number; maxDisplayCount: number };
	}>>([]);

	return (
		<main className="screen-nav-host">
			<div className="flex items-center justify-between px-4 py-2">
				<h1 className="text-lg font-semibold">Who Viewed Me</h1>
			</div>
			{views.length === 0 ? (
				<div className="flex flex-1 items-center justify-center p-6">
					<span className="text-center text-xl text-muted-foreground">
						No views yet
					</span>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 md:grid-cols-4">
					{views.map((view) => (
						<a
							key={view.profileId}
							href={view.isSecretAdmirer ? '#' : `/profile/${view.profileId}`}
							className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-muted"
						>
							{view.isSecretAdmirer ? (
								<div className="flex h-full items-center justify-center">
									<span className="text-4xl">❓</span>
								</div>
							) : (
								<div className="flex h-full items-center justify-center text-muted-foreground">
									{view.displayName?.charAt(0) ?? '?'}
								</div>
							)}
							<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
								{view.isSecretAdmirer ? (
									<span className="text-sm font-medium text-white">
										Secret Admirer
									</span>
								) : (
									<span className="text-sm font-medium text-white">
										{view.displayName}
									</span>
								)}
							</div>
						</a>
					))}
				</div>
			)}
		</main>
	);
}
