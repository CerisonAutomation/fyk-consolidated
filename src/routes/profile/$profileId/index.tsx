import { createFileRoute, Link } from '@tanstack/react-router';
import { useProfile, profileKeys } from '#/core/api/hooks/use-profiles';

export const Route = createFileRoute('/profile/$profileId/')({
	component: ProfilePage,
	loader: async ({ params, context }) => {
		const { queryClient } = context;
		await queryClient.ensureQueryData({
			queryKey: profileKeys.detail(Number(params.profileId)),
			queryFn: async () => {
				const { getProfileById } = await import('#/core/api/supabase/index');
				return await getProfileById(Number(params.profileId));
			},
		});
	},
});

function ProfilePage() {
	const { profileId } = Route.useParams();
	const { data: profile, isLoading, error } = useProfile(Number(profileId));

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex flex-1 items-center justify-center p-8">
				<div className="text-center">
					<p className="text-destructive">{error.message}</p>
					<Link to="/grid" className="mt-4 inline-block text-primary hover:underline">
						Back to grid
					</Link>
				</div>
			</div>
		);
	}

	const p = profile as unknown as Record<string, unknown>;
	const displayName = String(p.displayName ?? 'Anonymous');
	if (!displayName || displayName === 'undefined') {
		return (
			<div className="flex flex-1 items-center justify-center p-8">
				<div className="text-center">
					<p className="text-muted-foreground">Profile not found</p>
					<Link to="/grid" className="mt-4 inline-block text-primary hover:underline">
						Back to grid
					</Link>
				</div>
			</div>
		);
	}

	const age = p.age as number | null ?? null;
	const showAge = p.showAge as boolean ?? false;
	const distance = p.distance as number | null ?? null;
	const aboutMe = p.aboutMe as string | null ?? null;
	const bodyType = p.bodyType as string | null ?? null;
	const position = p.position as string | null ?? null;
	const hivStatus = p.hivStatus as string | null ?? null;
	const height = p.height as number | null ?? null;
	const weight = p.weight as number | null ?? null;
	const tribes = Array.isArray(p.tribes) ? (p.tribes as string[]) : [];
	const lookingFor = Array.isArray(p.lookingFor) ? (p.lookingFor as string[]) : [];
	const medias = Array.isArray(p.medias) ? (p.medias as Array<{ mediaHash: string }>) : [];
	const isFavorite = false;

	return (
		<div className="relative -mb-16 h-screen">
			<div className="h-full overflow-y-auto overscroll-contain">
				<main className="relative mx-auto min-h-[calc(100vh-4rem)] w-full max-w-2xl">
					<div className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur">
						<Link to="/grid" className="text-muted-foreground hover:text-foreground">
							←
						</Link>
						<div className="flex items-center gap-2">
							<button type="button" className="text-muted-foreground hover:text-foreground">
								{isFavorite ? '★' : '☆'}
							</button>
							<button type="button" className="text-muted-foreground hover:text-foreground">
								...
							</button>
						</div>
					</div>

					{medias.length > 0 ? (
						<div className="aspect-[3/4] w-full bg-muted">
							<img
								src={`https://cdns.grindr.com/images/profile/480x480/${medias[0].mediaHash}`}
								alt={displayName}
								className="h-full w-full object-cover"
							/>
						</div>
					) : (
						<div className="flex aspect-[3/4] w-full items-center justify-center bg-muted text-muted-foreground">
							No photos
						</div>
					)}

					<div className="space-y-4 p-4">
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-2xl font-bold">{displayName}</h1>
								{showAge && age !== null && (
									<span className="text-muted-foreground">{age}</span>
								)}
							</div>
							{distance !== null && (
								<p className="text-sm text-muted-foreground">
									{distance < 1000
										? `${Math.round(distance)}m away`
										: `${(distance / 1000).toFixed(1)}km away`}
								</p>
							)}
						</div>

						{aboutMe && (
							<div>
								<h2 className="mb-1 text-sm font-medium text-muted-foreground">
									About Me
								</h2>
								<p className="whitespace-pre-wrap">{aboutMe}</p>
							</div>
						)}

						<div className="grid grid-cols-2 gap-4">
							{bodyType && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">Body Type</h3>
									<p>{bodyType}</p>
								</div>
							)}
							{position && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">Position</h3>
									<p>{position}</p>
								</div>
							)}
							{height && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">Height</h3>
									<p>{height} cm</p>
								</div>
							)}
							{weight && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">Weight</h3>
									<p>{weight} kg</p>
								</div>
							)}
							{hivStatus && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">HIV Status</h3>
									<p>{hivStatus}</p>
								</div>
							)}
						</div>

						{tribes.length > 0 && (
							<div>
								<h3 className="mb-1 text-sm font-medium text-muted-foreground">Tribes</h3>
								<div className="flex flex-wrap gap-1">
									{tribes.map((tribe) => (
										<span key={tribe} className="rounded-full bg-muted px-2 py-0.5 text-xs">
											{tribe}
										</span>
									))}
								</div>
							</div>
						)}

						{lookingFor.length > 0 && (
							<div>
								<h3 className="mb-1 text-sm font-medium text-muted-foreground">Looking For</h3>
								<div className="flex flex-wrap gap-1">
									{lookingFor.map((item) => (
										<span key={item} className="rounded-full bg-muted px-2 py-0.5 text-xs">
											{item}
										</span>
									))}
								</div>
							</div>
						)}
					</div>
				</main>
			</div>

			<div className="fixed bottom-0 inset-x-0 border-t border-border bg-background p-3">
				<div className="flex items-center justify-center gap-4">
					<Link
						to="/chat/$conversationId"
						params={{ conversationId: String(profileId) }}
						className="rounded-lg bg-primary px-6 py-2 text-primary-foreground"
					>
						Message
					</Link>
					<button
						type="button"
						className="rounded-lg border border-border px-6 py-2"
						onClick={() => {
							// TODO: Wire tap action
						}}
					>
						Tap
					</button>
				</div>
			</div>
		</div>
	);
}
