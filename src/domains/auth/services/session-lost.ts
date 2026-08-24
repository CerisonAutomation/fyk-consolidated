import { signOut } from './sign-out';

let pending: Promise<void> | null = null;

export function signOutIfSessionLost(): Promise<void> {
	pending ??= confirmSessionLost().finally(() => {
		pending = null;
	});
	return pending;
}

async function confirmSessionLost(): Promise<void> {
	if (typeof window === 'undefined') return;
	const insideTheApp = window.location.pathname.startsWith('/grid') ||
		window.location.pathname.startsWith('/chat') ||
		window.location.pathname.startsWith('/interest') ||
		window.location.pathname.startsWith('/profile') ||
		window.location.pathname.startsWith('/settings');
	if (!insideTheApp) return;

	// Check if session is still valid
	// const profileId = await callMethod('auth_state').catch(() => null);
	// if (profileId !== null) return;

	await signOut();
}
