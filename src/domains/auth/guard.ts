import { redirect } from "@tanstack/react-router";
import { authClient } from "#/lib/auth-client";

/**
 * beforeLoad guard that checks for an active better-auth session.
 * Throws a redirect to /auth/sign-in when unauthenticated.
 *
 * Usage in a route definition:
 *   import { requireAuth } from "#/domains/auth/guard";
 *   export const Route = createFileRoute("/grid/")({
 *     beforeLoad: requireAuth,
 *     component: GridPage,
 *   });
 */
export async function requireAuth(): Promise<void> {
	const session = await authClient.getSession();
	if (!session?.data?.user) {
		throw redirect({ to: "/auth/sign-in" });
	}
}
