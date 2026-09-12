"use client";

import { useEffect } from "react";
import { setUnreadBadge } from "@/lib/badge";
import { api } from "@/lib/client";
import { registerServiceWorker } from "@/lib/persist";
import { onPushMessage, restorePush, syncPushSubscription } from "@/lib/push";

/**
 * Headless: renders nothing, and is the only thing in the app that owns the three device
 * capabilities that have to exist whether or not the user opens a particular screen — the
 * service-worker registration (offline shell + push), the home-screen badge, and the
 * `postMessage` channel the worker uses because it has no router, no providers and no session
 * object.
 *
 * It hangs off `__root.tsx` rather than off a screen for a specific reason. This behaviour first
 * went into `src/components/topbar.tsx`, which is exactly where the app kept it, and which
 * nothing renders: `grep -rn "<Topbar\|<Header" src` is empty, and §3.7's reachability
 * measurement counts both files in the 43% unreachable from any route. Wiring a capability to an
 * orphan is how `auth-gate.tsx` spent months being *described* as enforcing a redirect it never
 * ran (§2.16), and how `theme-init.js` sat correct and unreferenced while light mode flashed dark
 * (§2.22). The root route cannot be orphaned by definition, and `src/lib/app-shell.test.ts`
 * asserts that this component is mounted there.
 */
export function DeviceBridge() {
	useEffect(() => {
		void registerServiceWorker();

		let alive = true;
		const poll = () =>
			api<{ unread: number }>("/api/notifications")
				.then((r) => {
					if (alive) void setUnreadBadge(r.unread);
				})
				// An unread count is not worth a toast. The next tick retries, and offline the
				// service worker answers this route with JSON 504 rather than an HTML page.
				.catch(() => undefined);
		poll();
		const timer = setInterval(poll, 30_000);

		/**
		 * The worker cannot navigate, refetch or re-subscribe by itself, so it asks. Three
		 * messages, one listener:
		 *   * `fyk:navigate` — a notification was tapped. `location.assign` rather than the
		 *     router, because it also works while the route tree is still hydrating, which is
		 *     precisely when a notification gets tapped.
		 *   * `fyk:inbox-dirty` — a push arrived (or was dismissed) while the app is open, so
		 *     the badge is stale even though the user is not looking at the inbox.
		 *   * `fyk:push-resync` — the browser dropped the subscription. Re-subscribing needs
		 *     no prompt here because `restorePush()` refuses unless permission is *already*
		 *     granted; asking without a gesture would take a permanent silent denial.
		 */
		const off = onPushMessage((message) => {
			if (message.type === "fyk:navigate") {
				if (
					window.location.pathname + window.location.search !==
					message.href
				) {
					window.location.assign(message.href);
				}
				return;
			}
			if (message.type === "fyk:inbox-dirty") {
				poll();
				return;
			}
			void (async () => {
				await restorePush();
				await syncPushSubscription();
				if (alive) poll();
			})();
		});

		return () => {
			alive = false;
			clearInterval(timer);
			off();
		};
	}, []);

	return null;
}
