import { createRouter } from "@tanstack/react-router";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

/**
 * Router factory for the TanStack Start app. The `Register` augmentation at the
 * bottom is what gives every route its typed `loader`/`server.handlers` options,
 * so `src/routes/api/$.ts` is checked against the real router rather than `any`.
 */

function NotFound() {
	return (
		<div className="grid min-h-[60svh] place-items-center px-4 text-center">
			<div>
				<p className="font-display text-[64px] leading-none text-gold">404</p>
				<h1 className="mt-3 text-[20px] font-bold">
					That page is not part of FYK
				</h1>
				<p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted">
					The link may be old, or it may be a screen that was removed because it
					never worked. Everything below is real and reachable.
				</p>
				<nav className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[13px] font-semibold">
					<a
						href="/grid"
						className="press h-10 rounded-full bg-gold px-4 font-bold text-black"
					>
						Nearby
					</a>
					<a
						href="/board"
						className="press h-10 rounded-full border border-line px-4 text-ink-2"
					>
						Board
					</a>
					<a
						href="/chat"
						className="press h-10 rounded-full border border-line px-4 text-ink-2"
					>
						Chats
					</a>
					<a
						href="/events"
						className="press h-10 rounded-full border border-line px-4 text-ink-2"
					>
						Events
					</a>
					<a
						href="/settings"
						className="press h-10 rounded-full border border-line px-4 text-ink-2"
					>
						Settings
					</a>
				</nav>
			</div>
		</div>
	);
}

function Failed({ error }: { error: unknown }) {
	// The message only: a stack trace is for logs, and this screen is seen by users.
	const message =
		error instanceof Error && error.message.trim()
			? error.message
			: "Something broke while rendering this page.";
	return (
		<div className="grid min-h-[60svh] place-items-center px-4 text-center">
			<div className="max-w-md">
				<h1 className="text-[20px] font-bold">This screen stopped working</h1>
				<p className="mt-2 text-[13.5px] leading-relaxed text-muted">
					{message}
				</p>
				<div className="mt-5 flex items-center justify-center gap-2">
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="press h-10 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black"
					>
						Reload
					</button>
					<a
						href="/grid"
						className="press h-10 rounded-full border border-line px-4 text-[13.5px] font-semibold text-ink-2"
					>
						Go to Nearby
					</a>
				</div>
			</div>
		</div>
	);
}

export function getRouter() {
	return createRouter({
		routeTree,
		context: getContext(),
		defaultPreload: "intent",
		scrollRestoration: true,
		defaultNotFoundComponent: NotFound,
		defaultErrorComponent: Failed,
	});
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
