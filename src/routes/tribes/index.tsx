import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/tribes/')({
  component: lazyRouteComponent(() => import("../../components/tribes/tribes-client").then((m) => ({ default: m.TribesClient }))),
});
