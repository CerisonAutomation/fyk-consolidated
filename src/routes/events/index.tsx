import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/events/')({
  component: lazyRouteComponent(() => import("../../components/events/events-client").then((m) => ({ default: m.EventsClient }))),
});
