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
import { TanstackQueryProvider } from "#/integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext()({
	/**
	 * Headers every document response carries. `next.config.ts` used to set these and
	 * was deleted with the Next.js layer, which would have silently dropped them.
	 * HSTS is deliberately absent: it belongs to the TLS-terminating host, and a
	 * preload directive set from app code on a non-HTTPS origin is a footgun.
	 */
	headers: () => ({
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "SAMEORIGIN",
		"Referrer-Policy": "origin-when-cross-origin",
		// Camera and mic stay off — FYK has no calls. Geolocation is allowed for the
		// origin because onboarding and "nearby" ask for it with a user gesture.
		"Permissions-Policy": "camera=(), microphone=(), display-capture=()",
		"Cross-Origin-Opener-Policy": "same-origin",
	}),
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{ title: "FYK — Find Your King" },
			{
				name: "description",
				content:
					"FYK is a gay social and dating app for men: nearby discovery, a live Board, real conversations and IRL events. Adults only.",
			},
			{ name: "theme-color", content: "#08080c" },
			{ name: "color-scheme", content: "dark" },
			// App-store/preview crawlers must not index member profiles.
			{ name: "robots", content: "noindex, nofollow" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			// The square brand mark on the app background (`public/favicon.svg`,
			// derived from logo-square.svg). No manifest and no service worker: this
			// build has neither, so it asks for neither.
			{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&display=swap",
			},
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
 * Root layout: query provider → auth gate → route.
 *
 * Order matters. The gate runs before any page mounts so no surface can render a
 * cached skeleton as if it were the user's data, and the Suspense boundary only
 * covers code-splitting.
 */
function RootLayout() {
	return (
		<ErrorBoundary>
			<TanstackQueryProvider>
				<EntryShell>
					<Suspense
						fallback={
							<div className="grid min-h-[50svh] place-items-center">
								<LoadingSpinner size="lg" />
							</div>
						}
					>
						<Outlet />
					</Suspense>
				</EntryShell>
			</TanstackQueryProvider>
		</ErrorBoundary>
	);
}
