import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/gamechangers/')({
  component: lazyRouteComponent(() => import("../../components/gamechangers/gamechangers-client-omega").then((m) => ({ default: m.GamechangersClientOmega }))),
});
