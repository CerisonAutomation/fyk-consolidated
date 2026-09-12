/**
 * Home-screen app badge (the number on the icon).
 *
 * `setAppBadge` is a service-worker-scoped API: it throws `SecurityError` when the page is
 * not controlled by a registration, and is simply absent in Safari/Firefox desktop. It is
 * a convenience on top of the inbox, never a source of truth, and there is no UI to report
 * a failure to — so the whole thing is a best-effort, exception-swallowing setter whose
 * only job is to keep the count honest when the platform supports it.
 *
 * Two call sites on purpose: the notifications screen (where the unread count is
 * authoritative and changes as rows are marked read) and the topbar (which polls every
 * interval while the user is *elsewhere*, which is exactly when a badge matters).
 */
type BadgeNavigator = Navigator & {
	setAppBadge?: (contents?: number) => Promise<void>;
	clearAppBadge?: () => Promise<void>;
};

export async function setUnreadBadge(count: number): Promise<void> {
	if (typeof navigator === "undefined") return;
	const nav = navigator as BadgeNavigator;
	if (!nav.setAppBadge && !nav.clearAppBadge) return;
	if (!nav.serviceWorker) return;
	try {
		// A negative or fractional count is a bug in the caller, not something to display.
		const value = Math.max(0, Math.trunc(count));
		if (value === 0) await nav.clearAppBadge?.();
		else await nav.setAppBadge?.(value);
	} catch {
		// The badge is the least interesting thing that can fail here; the inbox row it
		// mirrors is already on screen.
	}
}
