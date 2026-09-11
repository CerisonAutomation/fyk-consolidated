import { createFileRoute } from "@tanstack/react-router";
import { OnboardingFlow } from "#/components/onboarding/onboarding-flow";

/**
 * `/onboarding` — the profile-completion flow.
 *
 * `main` deleted the previous 407-line route; `#/components/auth-gate` still
 * redirects here whenever a signed-in auth user has no `users` row, and the
 * `onboarding_done` column is what gates discovery everywhere else. A redirect
 * to a route that does not exist is a blank 404 page for the one user segment
 * that must not hit it (a brand-new account), so the route is restored as a
 * thin wrapper over the component that already implements the flow.
 */
export const Route = createFileRoute("/onboarding/")({
	component: OnboardingScreen,
	head: () => ({
		meta: [
			{ title: "Set up your profile · FYK" },
			{ name: "robots", content: "noindex,nocache" },
		],
	}),
});

function OnboardingScreen() {
	// `OnboardingFlow` takes the display name it greets the user with; the
	// session/profile is loaded inside the flow, so nothing is passed here.
	return <OnboardingFlow name="" />;
}
