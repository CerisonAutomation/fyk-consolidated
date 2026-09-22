import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/shouts/')({
  component: lazyRouteComponent(() => import("../../components/shouts/shouts-client-omega").then((m) => ({ default: m.ShoutsClientOmega }))),
});
