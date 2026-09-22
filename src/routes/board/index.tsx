import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/board/')({
  component: lazyRouteComponent(() => import("../../components/board/board-client-omega").then((m) => ({ default: m.BoardClientOmega }))),
});
