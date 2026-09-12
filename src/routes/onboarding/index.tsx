import { createFileRoute } from "@tanstack/react-router";
import { OnboardingFlow } from "#/components/onboarding/onboarding-flow";

/**
 * `/onboarding` — the profile-completion flow.
 *
 * `main` deleted the previous 407-line route, and it was restored because
 * `PUT /api/profile` is the endpoint that creates the `users` row an account
 * needs: without this route the flow had no screen of its own.
 *
 * Read this sentence as a correction, because an earlier version of this comment
 * promised something the code does not do: **nothing navigates here.** The entry
 * gate (`#/components/EntryShell`) shows an incomplete profile its own inline
 * `<Onboarding>` and never redirects, and `src/components/auth-gate.tsx` — which
 * three comments in this repository described as the thing that "redirects to
 * `/onboarding`" — was imported by nothing and has been deleted (AUDIT §3.3). So
 * this route is the deep-link surface (`/onboarding` typed or bookmarked), and
 * `onboarding_done` on the row it writes is what gates discovery everywhere else.
 * Two implementations of one flow is a real finding — AUDIT §3.7 lists it — but
 * deleting a reachable screen is not how a review is supposed to close one.
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
