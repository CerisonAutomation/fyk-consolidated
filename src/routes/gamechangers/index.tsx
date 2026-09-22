import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/gamechangers/')({
  component: lazyRouteComponent(() => import("../../components/gamechangers/gamechangers-client").then((m) => ({ default: m.GamechangersClient }))),
});
