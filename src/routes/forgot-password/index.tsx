import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/forgot-password` — the reset form lives with the rest of auth.
 *
 * The placeholder here fetched `/api/forgot-password` — a path nothing serves — and
 * rendered a list of items on a screen whose job is to take an email address. `#/routes/auth/sign-in` already has the reset panel (`?mode=forgot`),
 * which calls Supabase's `resetPasswordForEmail` — the only thing that can actually
 * send the link, since Supabase owns the credentials.
 *
 * A second reset form would be a second place to get the redirect URL wrong, so this
 * route forwards to the real one.
 */
export const Route = createFileRoute("/forgot-password/")({
	beforeLoad: () => {
		throw redirect({
			to: "/auth/sign-in",
			search: { mode: "forgot" },
			replace: true,
		});
	},
});
