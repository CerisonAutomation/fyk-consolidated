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
			{ title: "FYK — Find Your King" },
			{ name: "description", content: "Premium LGBTQ+ dating platform" },
			{
				// Exactly one viewport meta: with two, the earlier one (no `viewport-fit`) is what
				// a browser honours, and every safe-area rule in the stylesheet goes back to zero.
				// `viewport-fit=cover` is not decoration. The stylesheet spends ~10
				// declarations on `env(safe-area-inset-*)` — `--sat/--sab/--sal/--sar`,
				// the `safe-area-*` utilities, and the bottom bar's `padding-bottom` —
				// and on a notched phone those all evaluate to `0px` unless the page opts
				// in to the display area. Without this line the design *has* safe-area
				// padding and none of it applies, which is why the tab bar sat under the
				// home indicator while the CSS looked correct. No `maximum-scale`/
				// `user-scalable=no`: pinch-zoom is an accessibility requirement, and the
				// iOS "first load is short" trick it buys costs keyboard-aware layout.
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
				{
				// The *base* value only. Start de-duplicates `<meta name="…">` by `name`, so a
				// dark and a light variant cannot both be rendered from here — the later one wins
				// and the other silently vanishes (measured: the pair rendered as light alone).
				// `public/theme-init.js` therefore re-paints this from the resolved theme before
				// first paint, and keeps `#f9f8f7` for light mode. Both hexes are
				// `--color-background` in `src/styles.css`, regenerated into the manifest by
				// `pnpm icons:build` and asserted against the tokens by `src/lib/app-shell.test.ts`:
				// the manifest this replaces advertised `#0B0D11`, and its duplicate file
				// `#000000`/gold `#d4af37`, none of which any token defines, so every installed
				// launch showed a seam the design does not have.
				name: "theme-color",
				content: "#010101",
			},
			{
				// Lets the OS paint form controls, scrollbars and the callout bar for a dark
				// surface instead of leaving them light on a dark app.
				name: "color-scheme",
				content: "dark light",
			},
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
				{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
			{ rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/favicon-32.png" },
			// The `image/png` favicon is what iOS and Android launchers use; an SVG tab
			// icon would be invisible in light mode here, because `logo-square.svg`
			// carries no background of its own.
			{ rel: "apple-touch-icon", href: "/apple-touch-icon-180.png" },
			{ rel: "manifest", href: "/manifest.webmanifest" },
			{ rel: "preload", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&display=swap", as: "style" },
				{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Bebas+Neue&display=swap" },
		],
	}),
	// Runs before first paint on purpose: `<html>` is server-rendered with
	// `className="dark"` below, so a user who picked light mode got a black frame flash on
	// every load until React hydrated. `public/theme-init.js` is 520 bytes of
	// localStorage + matchMedia, already written, and previously referenced by nothing —
	// which is why the flash survived every previous pass.
	scripts: () => [{ src: "/theme-init.js" }],
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
