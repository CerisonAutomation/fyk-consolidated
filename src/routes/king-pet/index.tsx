import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/king-pet/')({
  component: lazyRouteComponent(() => import("../../components/king-pet/king-pet-client-omega").then((m) => ({ default: m.KingPetClientOmega }))),
});
