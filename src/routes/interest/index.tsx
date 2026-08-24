import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/interest/")({
	beforeLoad: () => {
		throw redirect({ to: "/interest/taps" });
	},
	component: () => null,
});
