import { createFileRoute } from "@tanstack/react-router";
import { VenueGuideClient } from "../../components/guide/venue-guide-client";

export const Route = createFileRoute("/guide/")({
  component: VenueGuideClient,
});
