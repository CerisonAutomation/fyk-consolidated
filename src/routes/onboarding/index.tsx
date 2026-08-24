import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { setPreferences } from '#/domains/settings/preferences';
import { useAuthStore } from '#/domains/auth/store';

export const Route = createFileRoute('/onboarding/')({
	component: OnboardingPage,
});

function OnboardingPage() {
	const [starting, setStarting] = useState(false);
	const { setAuth } = useAuthStore();

	const handleStart = async () => {
		setStarting(true);
		try {
			await setPreferences({ onboardingComplete: true });
			setAuth({ userId: '123456000' });
			if (typeof window !== 'undefined') {
				window.location.href = '/grid';
			}
		} catch (error) {
			setStarting(false);
			console.error("Couldn't finish setup", error);
		}
	};

	return (
		<main className="flex min-h-dvh flex-col px-8 pt-8">
			<div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
				<div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-primary/10">
					<span className="text-5xl">🔥</span>
				</div>
				<div className="flex flex-col gap-1">
					<h1 className="font-heading text-3xl font-semibold tracking-tight">
						FYK
					</h1>
					<p className="text-xl text-muted-foreground">
						Find Your King
					</p>
				</div>
				<p className="max-w-sm text-balance text-muted-foreground">
					A modern dating platform with privacy at its core. Free, open-source, and community-driven.
				</p>
			</div>

			<div className="sticky bottom-0 flex shrink-0 flex-col items-center gap-2 bg-background pt-2 pb-8">
				<button
					onClick={handleStart}
					disabled={starting}
					className="w-full max-w-xs rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				>
					{starting ? 'Setting up...' : 'Get started'}
				</button>
			</div>
		</main>
	);
}
