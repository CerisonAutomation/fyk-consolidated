import { createFileRoute } from "@tanstack/react-router";
import { InterestClient } from "../../../components/interest/interest-client";

export const Route = createFileRoute("/interest/taps/")({
 component: InterestClient,
});
