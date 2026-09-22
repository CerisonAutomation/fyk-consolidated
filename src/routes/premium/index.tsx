import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/premium/')({
  component: lazyRouteComponent(() => import("../../components/premium/premium-client").then((m) => ({ default: m.PremiumClient }))),
});
