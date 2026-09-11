import { getSupabase } from "#/integrations/supabase/client";
import { clearAccountCaches } from "#/core/api/account-caches";
import { clearAccountPreferences } from "#/domains/settings/preferences";

export async function signOut(): Promise<void> {
	try {
		const client = getSupabase();
		if (client) await client.auth.signOut();
	} catch (error) {
		console.error("[auth/sign-out] Failed to sign out:", error);
	}

	// Navigate to sign-in
	if (typeof window !== "undefined") {
		window.location.href = "/auth/sign-in";
	}

	clearAccountCaches();

	try {
		await clearAccountPreferences();
	} catch (error) {
		console.error("[auth/sign-out] Failed to clear preferences:", error);
	}
}
