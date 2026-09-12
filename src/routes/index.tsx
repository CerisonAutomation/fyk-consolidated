import { createFileRoute, Navigate } from "@tanstack/react-router";

/**
 * `/` is the app's front door. FYK has no anonymous marketing page inside the
 * gate — a signed-out visitor sees auth, and a signed-in visitor lands on Nearby,
 * which is the core loop. The previous "landing page" was unreachable dead UI
 * that advertised on-device ML the app never shipped.
 */
export const Route = createFileRoute("/")({
	component: () => <Navigate to="/grid" replace />,
});
