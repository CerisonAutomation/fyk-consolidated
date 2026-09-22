import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/onboarding/")({
  component: lazyRouteComponent(() => import("../../components/onboarding/onboarding-client").then((m) => ({ default: m.OnboardingClient }))),
  head: () => ({
    meta: [
      { title: "Set up your profile · FYK" },
      { name: "robots", content: "noindex,nocache" },
    ],
  }),
});
