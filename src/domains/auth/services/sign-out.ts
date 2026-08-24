import { clearAccountCaches } from '#/core/api/account-caches';
import { clearAccountPreferences } from '#/domains/settings/preferences';

export async function signOut(): Promise<void> {
	try {
		// Call the logout API method
		// await callMethod('logout');
	} catch (error) {
		console.error(error);
	}

	// Navigate to sign-in
	if (typeof window !== 'undefined') {
		window.location.href = '/auth/sign-in';
	}

	clearAccountCaches();

	try {
		await clearAccountPreferences();
	} catch (error) {
		console.error(error);
	}
}
