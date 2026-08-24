import { clearAccountCaches } from "#/core/api/account-caches";
import { clearAccountPreferences } from "#/domains/settings/preferences";
import { authClient } from "#/lib/auth-client";
import { setAuth } from "#/domains/auth/store";

export async function signOut(): Promise<void> {
	try {
		await authClient.signOut();
	} catch (error) {
		console.error("Better-auth signOut failed:", error);
	}

	// Clear local auth state
	setAuth(null);

	// Clear account-scoped caches
	clearAccountCaches();

	try {
		await clearAccountPreferences();
	} catch (error) {
		console.error("Failed to clear preferences:", error);
	}

	// Navigate to sign-in
	if (typeof window !== "undefined") {
		window.location.href = "/auth/sign-in";
	}
}
