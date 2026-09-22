import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/guide/')({
  component: lazyRouteComponent(() => import("../../components/guide/venue-guide-client").then((m) => ({ default: m.VenueGuideClient }))),
});
