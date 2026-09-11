import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { TanstackQueryProvider } from "#/integrations/tanstack-query/root-provider";
import { EntryShell } from "#/components/EntryShell";

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
 * Root layout -- wraps every route with the auth boundary and query provider.
 * EntryShell checks the Supabase session, renders sign-in when signed out,
 * renders onboarding when the profile is incomplete, and renders children
 * (via Outlet) when fully authenticated.
 */
function RootLayout() {
	return (
		<TanstackQueryProvider>
			<EntryShell>
				<Outlet />
			</EntryShell>
		</TanstackQueryProvider>
	);
}
