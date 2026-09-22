import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/chat/")({
  component: lazyRouteComponent(() => import("../../components/chat/messages-client").then((m) => ({ default: m.MessagesClient }))),
});
