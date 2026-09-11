import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/lib/auth";
import { authRateLimit } from "#/lib/rate-limit";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const blocked = await authRateLimit(request);
				if (blocked) return blocked;
				return auth.handler(request);
			},
			POST: async ({ request }) => {
				const blocked = await authRateLimit(request);
				if (blocked) return blocked;
				return auth.handler(request);
			},
		},
	},
});
