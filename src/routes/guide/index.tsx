import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/guide/')({
  component: lazyRouteComponent(() => import("../../components/guide/guide-client-omega").then((m) => ({ default: m.GuideClientOmega }))),
});
