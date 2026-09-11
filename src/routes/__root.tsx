import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { Suspense } from "react";
import { EntryShell } from "#/components/EntryShell";
import { ErrorBoundary } from "#/components/ErrorBoundary";
import { LoadingSpinner } from "#/components/FYKLoadingSpinner";
import { SupabaseSessionProvider } from "#/integrations/supabase/session-provider";
import { TanstackQueryProvider } from "#/integrations/tanstack-query/root-provider";
import { noStoreHeaders, securityHeaders } from "#/lib/security";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "FYK — Find Your King" },
			{ name: "description", content: "Premium LGBTQ+ dating platform" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "preload",
				href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&display=swap",
				as: "style",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&display=swap",
			},
		],
	}),
	/**
	 * Response headers for every SSR document. This is the only hook TanStack
	 * Start gives a route to set *server* headers on the HTML response — the
	 * `next.config.ts` this replaced was never read by anything (there is no
	 * Next.js in this project), so hardening headers existed only in docs.
	 */
	headers: () => ({
		...securityHeaders(),
		// Every screen of this app can carry caller-specific data (the shell
		// resolves the session on load), so the document itself must never be
		// cached — not by a CDN, not by a browser reusing a heuristic freshness
		// window for a response that arrived without `Cache-Control`.
		...noStoreHeaders(),
	}),
	shellComponent: RootDocument,
	component: RootLayout,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

/**
 * Root layout -- wraps every route with error boundary, suspense, query provider, and auth boundary.
 *
 * - ErrorBoundary catches rendering errors and shows a fallback (React docs pattern).
 * - Suspense shows a loading spinner while route components load (code splitting pattern).
 * - Per the performance docs: "Route-based splitting with Suspense fallback".
 */
function RootLayout() {
	return (
		<ErrorBoundary>
			<TanstackQueryProvider>
				{/*
				 * Mounted here because `useSupabaseSession()` is consumed by the
				 * board, stories, groups, fansites, tribes, premium and profile
				 * surfaces; without a provider above them they always read the
				 * context default (`user: null`), i.e. "signed out", for every
				 * visitor — including signed-in ones.
				 */}
				<SupabaseSessionProvider>
					<EntryShell>
						<Suspense
							fallback={
								<div className="grid min-h-[100svh] place-items-center bg-canvas">
									<LoadingSpinner size="lg" />
								</div>
							}
						>
							<Outlet />
						</Suspense>
					</EntryShell>
				</SupabaseSessionProvider>
			</TanstackQueryProvider>
		</ErrorBoundary>
	);
}
