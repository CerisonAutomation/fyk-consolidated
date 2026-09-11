import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { Suspense } from "react";
import appCss from "../styles.css?url";
import { TanstackQueryProvider } from "#/integrations/tanstack-query/root-provider";
import { EntryShell } from "#/components/EntryShell";
import { ErrorBoundary } from "#/components/ErrorBoundary";
import { LoadingSpinner } from "#/components/FYKLoadingSpinner";
import { SupabaseSessionProvider } from "#/integrations/supabase/session-provider";
import { noStoreHeaders, securityHeaders } from "#/lib/security";

export const Route = createRootRouteWithContext()({
	/**
	 * Server response headers for every SSR document — a route's `headers()` is the
	 * only hook Start gives you. The `next.config.ts` that used to advertise a CSP
	 * here was never read by anything, so production shipped no hardening headers.
	 * `no-store` because every screen can carry caller-specific data, and an HTML
	 * response without `Cache-Control` gets cached heuristically by browsers.
	 */
	headers: () => ({ ...securityHeaders(), ...noStoreHeaders() }),
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
				{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
			{ rel: "preload", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&display=swap", as: "style" },
				{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&display=swap" },
		],
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
				{/* `useSupabaseSession()` has a default context, so skipping this did
				    not crash the nine components that call it — it kept them signed out. */}
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
