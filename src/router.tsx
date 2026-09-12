import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { getContext } from "./integrations/tanstack-query/root-provider";

function DefaultNotFound() {
	return (
		<div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
			<h1 className="text-2xl font-bold">Page Not Found</h1>
			<a href="/" className="text-yellow-500 hover:underline">Go Home</a>
		</div>
	);
}

function DefaultError({ error }: { error: Error }) {
	return (
		<div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
			<h1 className="text-2xl font-bold text-red-500">Error</h1>
			<p>{error.message}</p>
			<a href="/" className="text-yellow-500 hover:underline">Go Home</a>
		</div>
	);
}

export function getRouter() {
	const context = getContext();
	return createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultNotFoundComponent: DefaultNotFound,
		defaultErrorComponent: DefaultError,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
