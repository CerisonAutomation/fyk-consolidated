import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/tribes/')({
  component: lazyRouteComponent(() => import("../../components/tribes/tribes-client-omega").then((m) => ({ default: m.TribesClientOmega }))),
});
