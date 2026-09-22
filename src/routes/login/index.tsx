import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/login` — one auth screen, not two.
 *
 * This route was a generated placeholder: it fetched `/api/login` (a path nothing
 * serves) and posted its card button to `/api/login/{id}/action`, while rendering a
 * list of "items" on a screen whose job is to take an email and a password. The real
 * form has always been `#/routes/auth/sign-in`, which signs in with Supabase, signs
 * up, sends a reset link, sends a magic link and handles the 2FA step.
 *
 * Two login screens is two places for the password handling to drift, so this one
 * redirects instead of rendering. `replace: true` keeps the placeholder out of
 * history: pressing back from the sign-in screen should leave the app, not return to
 * a route that immediately forwards again.
 */
export const Route = createFileRoute("/login/")({
	beforeLoad: () => {
		throw redirect({ to: "/auth/sign-in", replace: true });
	},
});
