import { createFileRoute } from "@tanstack/react-router";
import { handleApi } from "#/server/router";

/**
 * Single entry point for the FYK API.
 *
 * TanStack Start gives this handler the raw Request, so CORS/CSRF, rate limits,
 * validation and error shaping are all handled inside `#/server/router` rather
 * than being re-derived per endpoint.
 */
export const Route = createFileRoute("/api/$")({
	server: {
		handlers: {
			GET: async ({ request }) => handleApi(request),
			POST: async ({ request }) => handleApi(request),
			PATCH: async ({ request }) => handleApi(request),
			DELETE: async ({ request }) => handleApi(request),
			PUT: async ({ request }) => handleApi(request),
		},
	},
});
