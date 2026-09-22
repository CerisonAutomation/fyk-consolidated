import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/discover')({
  component: lazyRouteComponent(() => import("../components/explore/explore-client").then((m) => ({ default: m.ExploreClient }))),
});
