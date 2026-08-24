import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "#/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback/")({
	component: AuthCallback,
});

function AuthCallback() {
	const navigate = useNavigate();

	useEffect(() => {
		supabase.auth.onAuthStateChange((event, _session) => {
			if (event === "PASSWORD_RECOVERY") {
				// Redirect to password reset page if you have one
				navigate({ to: "/auth/sign-in" });
			} else if (event === "SIGNED_IN") {
				navigate({ to: "/" });
			}
		});

		// Handle the URL hash for email confirmation
		const hash = window.location.hash;
		if (hash) {
			supabase.auth.onAuthStateChange(() => {
				navigate({ to: "/" });
			});
		}
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
