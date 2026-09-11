import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/interest/taps/")({
 component: InterestIndex,
});

function InterestIndex() {
 return <Navigate to="/interest/taps" replace />;
}
