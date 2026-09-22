import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/groups/')({
  component: lazyRouteComponent(() => import("../../components/groups/groups-client-omega").then((m) => ({ default: m.GroupsClientOmega }))),
});
