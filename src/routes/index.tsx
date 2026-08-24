import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/grid" });
	},
	component: RedirectPage,
});

function RedirectPage() {
	return null;
}
