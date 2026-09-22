import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/premium/')({
  component: lazyRouteComponent(() => import("../../components/premium/premium-client-omega").then((m) => ({ default: m.PremiumClientOmega }))),
});
