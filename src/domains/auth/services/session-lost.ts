import { signOut } from "./sign-out";
import { authClient } from "#/lib/auth-client";

let pending: Promise<void> | null = null;

export function signOutIfSessionLost(): Promise<void> {
	pending ??= confirmSessionLost().finally(() => {
		pending = null;
	});
	return pending;
}

async function confirmSessionLost(): Promise<void> {
	if (typeof window === "undefined") return;

	const insideTheApp =
		window.location.pathname.startsWith("/grid") ||
		window.location.pathname.startsWith("/chat") ||
		window.location.pathname.startsWith("/interest") ||
		window.location.pathname.startsWith("/profile") ||
		window.location.pathname.startsWith("/settings") ||
		window.location.pathname.startsWith("/right-now");

	if (!insideTheApp) return;

	try {
		const session = await authClient.getSession();
		if (session?.data?.user) return;
	} catch {
		// Session check failed - treat as lost
	}

	await signOut();
}
