import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute('/board/')({
  component: lazyRouteComponent(() => import("../../components/board/board-client").then((m) => ({ default: m.BoardClient }))),
});
