import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/meetnow/')({
  component: lazyRouteComponent(() => import("../../components/meetnow/meetnow-client").then((m) => ({ default: m.MeetNowClient }))),
});
