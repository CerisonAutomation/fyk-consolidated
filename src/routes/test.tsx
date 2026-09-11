import { createFileRoute } from "@tanstack/react-router";

function TestPage() {
	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">FYK Test Page</h1>
			<p className="mt-4">Server is working!</p>
		</div>
	);
}

export const Route = createFileRoute("/test")({
	component: TestPage,
});
