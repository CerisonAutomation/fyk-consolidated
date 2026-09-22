import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/fansites/')({
  component: lazyRouteComponent(() => import("../../components/fansites/fansites-client-omega").then((m) => ({ default: m.FansitesClientOmega }))),
});
