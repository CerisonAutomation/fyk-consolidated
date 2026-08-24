import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/profile/$profileId/')({
	component: ProfilePage,
});

interface ProfileData {
	profileId: number;
	displayName: string | null;
	age: number | null;
	showAge: boolean;
	distance: number | null;
	aboutMe: string | null;
	bodyType: string | null;
	sexualPosition: string | null;
	hivStatus: string | null;
	height: number | null;
	weight: number | null;
	grindrTribes: string[];
	lookingFor: string[];
	medias: Array<{ mediaHash: string }>;
	onlineUntil: number | null;
	isFavorite: boolean;
}

function ProfilePage() {
	const { profileId } = Route.useParams();
	const [profile, setProfile] = useState<ProfileData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		// TODO: Wire to actual API
		setLoading(false);
		setProfile({
			profileId: Number(profileId),
			displayName: 'Demo User',
			age: 28,
			showAge: true,
			distance: 1500,
			aboutMe: 'This is a demo profile. The actual profile data will be loaded from the API.',
			bodyType: 'Athletic',
			sexualPosition: 'Versatile',
			hivStatus: 'Negative',
			height: 178,
			weight: 75,
			grindrTribes: ['Geek'],
			lookingFor: ['Chat', 'Friends'],
			medias: [],
			onlineUntil: null,
			isFavorite: false,
		});
	}, [profileId]);

	if (loading) {
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
					<a href="/grid" className="mt-4 inline-block text-primary hover:underline">
						Back to grid
					</a>
				</div>
			</div>
		);
	}

	if (!profile) {
		return (
			<div className="flex flex-1 items-center justify-center p-8">
				<div className="text-center">
					<p className="text-muted-foreground">Profile not found</p>
					<a href="/grid" className="mt-4 inline-block text-primary hover:underline">
						Back to grid
					</a>
				</div>
			</div>
		);
	}

	return (
		<div className="relative -mb-16 h-screen">
			<div className="h-full overflow-y-auto overscroll-contain">
				<main className="relative mx-auto min-h-[calc(100vh-4rem)] w-full max-w-2xl">
					{/* Top Nav */}
					<div className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur">
						<a href="/grid" className="text-muted-foreground hover:text-foreground">
							←
						</a>
						<div className="flex items-center gap-2">
							<button className="text-muted-foreground hover:text-foreground">
								{profile.isFavorite ? '★' : '☆'}
							</button>
							<button className="text-muted-foreground hover:text-foreground">
								...
							</button>
						</div>
					</div>

					{/* Profile Images */}
					{profile.medias.length > 0 ? (
						<div className="aspect-[3/4] w-full bg-muted">
							<img
								src={`https://cdns.grindr.com/images/profile/480x480/${profile.medias[0].mediaHash}`}
								alt={profile.displayName ?? 'Profile'}
								className="h-full w-full object-cover"
							/>
						</div>
					) : (
						<div className="flex aspect-[3/4] w-full items-center justify-center bg-muted text-muted-foreground">
							No photos
						</div>
					)}

					{/* Profile Info */}
					<div className="space-y-4 p-4">
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-2xl font-bold">
									{profile.displayName ?? 'Anonymous'}
								</h1>
								{profile.showAge && profile.age !== null && (
									<span className="text-muted-foreground">{profile.age}</span>
								)}
							</div>
							{profile.distance !== null && (
								<p className="text-sm text-muted-foreground">
									{profile.distance < 1000
										? `${Math.round(profile.distance)}m away`
										: `${(profile.distance / 1000).toFixed(1)}km away`}
								</p>
							)}
						</div>

						{profile.aboutMe && (
							<div>
								<h2 className="mb-1 text-sm font-medium text-muted-foreground">
									About Me
								</h2>
								<p className="whitespace-pre-wrap">{profile.aboutMe}</p>
							</div>
						)}

						<div className="grid grid-cols-2 gap-4">
							{profile.bodyType && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">
										Body Type
									</h3>
									<p>{profile.bodyType}</p>
								</div>
							)}
							{profile.sexualPosition && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">
										Position
									</h3>
									<p>{profile.sexualPosition}</p>
								</div>
							)}
							{profile.height && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">
										Height
									</h3>
									<p>{profile.height} cm</p>
								</div>
							)}
							{profile.weight && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">
										Weight
									</h3>
									<p>{profile.weight} kg</p>
								</div>
							)}
							{profile.hivStatus && (
								<div>
									<h3 className="text-sm font-medium text-muted-foreground">
										HIV Status
									</h3>
									<p>{profile.hivStatus}</p>
								</div>
							)}
						</div>

						{profile.grindrTribes.length > 0 && (
							<div>
								<h3 className="mb-1 text-sm font-medium text-muted-foreground">
									Tribes
								</h3>
								<div className="flex flex-wrap gap-1">
									{profile.grindrTribes.map((tribe) => (
										<span
											key={tribe}
											className="rounded-full bg-muted px-2 py-0.5 text-xs"
										>
											{tribe}
										</span>
									))}
								</div>
							</div>
						)}

						{profile.lookingFor.length > 0 && (
							<div>
								<h3 className="mb-1 text-sm font-medium text-muted-foreground">
									Looking For
								</h3>
								<div className="flex flex-wrap gap-1">
									{profile.lookingFor.map((item) => (
										<span
											key={item}
											className="rounded-full bg-muted px-2 py-0.5 text-xs"
										>
											{item}
										</span>
									))}
								</div>
							</div>
						)}
					</div>
				</main>
			</div>

			{/* Bottom Nav */}
			<div className="fixed bottom-0 inset-x-0 border-t border-border bg-background p-3">
				<div className="flex items-center justify-center gap-4">
					<a
						href={`/chat/${profile.profileId}`}
						className="rounded-lg bg-primary px-6 py-2 text-primary-foreground"
					>
						Message
					</a>
					<button
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
