import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { requireSupabase } from "#/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback/")({
	component: AuthCallback,
});

function AuthCallback() {
	const navigate = useNavigate();

	useEffect(() => {
		// Handle the URL hash for email confirmation / magic link
		const handleAuth = async () => {
			const {
				data: { session },
			} = await requireSupabase().auth.getSession();

			if (session) {
				navigate({ to: "/grid", replace: true });
				return;
			}

			// Listen for auth state changes
			const {
				data: { subscription },
			} = requireSupabase().auth.onAuthStateChange((event, newSession) => {
				if (event === "PASSWORD_RECOVERY") {
					navigate({ to: "/auth/sign-in", replace: true });
				} else if (newSession) {
					navigate({ to: "/grid", replace: true });
				}
			});

			return () => subscription.unsubscribe();
		};

		handleAuth();
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
