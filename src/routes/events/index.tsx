import { createFileRoute } from "@tanstack/react-router";
import { EventsClient } from "../../components/events/events-client";

export const Route = createFileRoute("/events/")({
  component: EventsClient,
});
