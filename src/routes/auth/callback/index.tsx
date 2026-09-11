import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { requireSupabase } from "#/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback/")({
	component: AuthCallback,
});

/**
 * Auth callback route -- handles email confirmation, magic link, and OAuth redirects.
 *
 * Supabase's PKCE flow exchanges the code for a session via detectSessionInUrl.
 * Once the session is established, we navigate to "/" and let EntryShell
 * determine whether the user needs onboarding or can enter the main app.
 */
function AuthCallback() {
	const navigate = useNavigate();

	useEffect(() => {
		const client = requireSupabase();
		let cancelled = false;
		let subscription: { unsubscribe: () => void } | null = null;

		const handleAuth = async () => {
			// getSession() triggers PKCE code exchange if a code is in the URL
			const { data: { session }, error } = await client.auth.getSession();

			if (cancelled) return;

			if (session) {
				// Session established -- navigate to root and let EntryShell route
				navigate({ to: "/", replace: true });
				return;
			}

			if (error) {
				console.error("[auth/callback] Session restore failed:", error.message);
				navigate({ to: "/", replace: true });
				return;
			}

			// No session yet -- listen for auth state change (async PKCE exchange)
			const { data: { subscription: sub } } = client.auth.onAuthStateChange((event, newSession) => {
				if (cancelled) return;

				if (event === "PASSWORD_RECOVERY") {
					// EntryShell handles PASSWORD_RECOVERY via its own onAuthStateChange listener.
					// Navigate to root so EntryShell picks up the recovery flow.
					navigate({ to: "/", replace: true });
				} else if (newSession) {
					navigate({ to: "/", replace: true });
				}
			});

			subscription = sub;
		};

		void handleAuth();

		return () => {
			cancelled = true;
			subscription?.unsubscribe();
		};
	}, [navigate]);

	return (
		<main className="flex min-h-dvh items-center justify-center">
			<div className="flex flex-col items-center gap-4">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-800 dark:border-t-neutral-100" />
				<p className="text-sm text-muted-foreground">
					Verifying your account...
				</p>
			</div>
		</main>
	);
}
