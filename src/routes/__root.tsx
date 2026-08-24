import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { NavBar } from "#/core/ui/organisms/NavBar";
import { useConversationsStore } from "#/domains/chat/store";
import { getAuthSnapshot } from "#/domains/auth/store";
import { authClient } from "#/lib/auth-client";
import TanStackQueryDevtools from "#/integrations/tanstack-query/devtools";
import TanstackQueryProvider from "#/integrations/tanstack-query/root-provider";
import StoreDevtools from "#/lib/demo-store-devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

const PUBLIC_PATH_PREFIXES = ["/auth", "/onboarding", "/demo"];

function isPublicRoute(pathname: string): boolean {
	if (pathname === "/") return true;
	return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "FYK",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	beforeLoad: ({ location }) => {
		const { auth } = getAuthSnapshot();
		const isAuthenticated = auth?.userId != null;

		if (!isAuthenticated && !isPublicRoute(location.pathname)) {
			throw redirect({ to: "/auth/sign-in" });
		}
	},
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
				<TanstackQueryProvider>
					<AppShell>{children}</AppShell>
				</TanstackQueryProvider>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
						StoreDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}

function AppShell({ children }: { children: React.ReactNode }) {
	const location = useLocation();
	const { data: session } = authClient.useSession();
	const { entries } = useConversationsStore();
	const hasUnread = entries.some(
		(e: { data: { unreadCount: number } }) => e.data.unreadCount > 0,
	);

	// Hide NavBar on auth, onboarding, demo, and root redirect pages
	const hideNavBar =
		location.pathname.startsWith("/auth") ||
		location.pathname.startsWith("/onboarding") ||
		location.pathname.startsWith("/demo") ||
		location.pathname === "/";

	if (hideNavBar) {
		return <>{children}</>;
	}

	return (
		<div className="flex min-h-screen flex-col">
			<main className="flex-1 pb-20">{children}</main>
			<NavBar
				profileMediaHash={session?.user?.id ?? null}
				hasUnread={hasUnread}
			/>
		</div>
	);
}
