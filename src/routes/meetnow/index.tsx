import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/meetnow/')({
  component: lazyRouteComponent(() => import("../../components/meetnow/meetnow-client-omega").then((m) => ({ default: m.MeetNowClientOmega }))),
});
