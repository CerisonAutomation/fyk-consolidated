/**
 * Web push, from the browser's side.
 *
 * WHAT WAS ACTUALLY BROKEN
 * ------------------------
 * `notifications-client.tsx` called this on mount, and nothing about the pipeline beyond
 * it was real:
 *
 *   1. it awaited `navigator.serviceWorker.ready` without ever registering a worker, so
 *      the promise never resolved and the function hung for the life of the page — after
 *      it had already asked the user for notification permission, which is the one prompt
 *      a browser will not ask twice. Permission spent, nothing delivered.
 *   2. `public/sw.js` had no `push` handler, so even a subscription obtained by other
 *      means would have had every payload dropped by the browser.
 *   3. the delivery side (`supabase/functions/notify`) was `verify_jwt = true` by
 *      configuration default while its only caller is Postgres, so it 401'd; and it wrote
 *      a row into `notifications`, a table whose own trigger calls it.
 *
 * So the whole point of this module is that every step is either *done* or *reported as a
 * state the UI can show*. A `catch {}` around a feature the user cannot inspect is how
 * (1) survived as long as it did.
 *
 * Contract notes, because they are the parts that are easy to get wrong twice:
 *   * Permission is requested **only** from a user gesture. Chrome and Safari both
 *     suppress or penalise an automatic prompt, and an automatic prompt on a screen the
 *     user just opened is how a dating app gets permanently blocked.
 *   * iOS only delivers push to an installed web app (`display-mode: standalone`), so on
 *     iPhone Safari the honest state is "add to Home Screen", not "enable".
 *   * `PushManager.unsubscribe()` is local. Without the `DELETE` on
 *     `/api/push/subscribe` the server keeps a live endpoint for a device whose owner said
 *     stop — on this app that is not an annoyance, it is a safety problem.
 */
import { ApiError, api } from "@/lib/client";
import { serviceWorkerRegistration } from "@/lib/persist";

export type PushState =
	| { kind: "unsupported"; reason: string }
	| { kind: "dev-server" }
	| { kind: "no-vapid-key" }
	| { kind: "needs-install" }
	| { kind: "prompt" }
	| { kind: "denied" }
	| { kind: "off" }
	| { kind: "on"; endpoint: string }
	| { kind: "error"; message: string };

const VAPID_KEY = (): string => {
	const value = import.meta.env.VITE_VAPID_PUBLIC_KEY;
	return typeof value === "string" ? value.trim() : "";
};

const isIos = (): boolean =>
	typeof navigator !== "undefined" &&
	(/iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const isStandalone = (): boolean =>
	typeof window !== "undefined" &&
	(window.matchMedia?.("(display-mode: standalone)").matches ||
		// `navigator.standalone` is a Safari-only boolean that no lib.dom declares, and
		// it is the only reliable signal on iOS.
		(navigator as unknown as { standalone?: boolean }).standalone === true);

/** Base64url → bytes, the shape `applicationServerKey` wants. The explicit
 * `ArrayBuffer` generic is what TypeScript 5.7+ needs here: `BufferSource` wants a view
 * over a non-shared buffer, and `new Uint8Array(n)` is typed as possibly shared. */
function toKey(base64url: string): Uint8Array<ArrayBuffer> {
	const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
	const binary = atob(
		base64url.replace(/-/g, "+").replace(/_/g, "/") + padding,
	);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function existing(): Promise<PushSubscription | null> {
	const reg = await serviceWorkerRegistration();
	if (!reg) return null;
	return reg.pushManager.getSubscription();
}

/** Every gate that is not the user's to decide, checked in the order a fix needs. */
async function preflight(): Promise<PushState | null> {
	if (typeof window === "undefined")
		return { kind: "unsupported", reason: "server" };
	if (!("Notification" in window) || !("PushManager" in window)) {
		return { kind: "unsupported", reason: "this browser has no push support" };
	}
	if (isIos() && !isStandalone()) {
		// Before the permission check on purpose: on iOS, permission inside the browser is
		// meaningless for web push, and asking for it here teaches the user to say no.
		return { kind: "needs-install" };
	}
	if (!import.meta.env.PROD) return { kind: "dev-server" };
	if (!VAPID_KEY()) return { kind: "no-vapid-key" };
	if (Notification.permission === "denied") return { kind: "denied" };
	if (Notification.permission === "default") return { kind: "prompt" };
	const sub = await existing();
	if (!sub) return { kind: "off" };
	return { kind: "on", endpoint: sub.endpoint };
}

export async function readPushState(): Promise<PushState> {
	try {
		const gate = await preflight();
		return gate ?? { kind: "off" };
	} catch (error) {
		return { kind: "error", message: message(error) };
	}
}

/**
 * Ask for permission, subscribe, and tell the server. Safe to call repeatedly: a browser
 * that already granted it skips the prompt, and the API upserts on `(user_id, endpoint)`.
 */
export async function enablePush(): Promise<PushState> {
	const gate = await preflight();
	// `prompt` is the one state worth continuing past: it means "ask now", which is what the
	// caller pressed. Everything else (denied, no key, unsupported) is returned untouched so
	// the UI can say why.
	if (gate && gate.kind !== "prompt") return gate;

	if (Notification.permission === "default") {
		const granted = await Notification.requestPermission();
		if (granted !== "granted") {
			return granted === "denied" ? { kind: "denied" } : { kind: "prompt" };
		}
	}

	const reg = await serviceWorkerRegistration();
	if (!reg) {
		return { kind: "unsupported", reason: "service worker unavailable" };
	}

	let subscription: PushSubscription;
	try {
		const found = await reg.pushManager.getSubscription();
		subscription =
			found ??
			(await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: toKey(VAPID_KEY()),
			}));
	} catch (error) {
		// Chrome throws here when the VAPID key is not the one the origin's worker was
		// subscribed with, which is the usual symptom of a rotated key pair.
		return { kind: "error", message: `subscribe failed: ${message(error)}` };
	}

	const json = subscription.toJSON();
	if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
		return {
			kind: "error",
			message: "the browser returned an incomplete subscription",
		};
	}

	try {
		await api("/api/push/subscribe", {
			method: "POST",
			body: {
				endpoint: json.endpoint,
				p256dh: json.keys.p256dh,
				auth: json.keys.auth,
			},
		});
	} catch (error) {
		// The subscription is real and stays: the server-side row is what failed, so the
		// retry must not be "grant permission again", it is "store this again".
		return {
			kind: "error",
			message: `subscribed, but the server did not record it: ${message(error)}`,
		};
	}

	return { kind: "on", endpoint: json.endpoint };
}

/**
 * Turn push off for *this device*, locally and on the server. `remote=false` is used by
 * the `pushsubscriptionchange` path, where the endpoint is already dead and the server's
 * own 404/410 sweep will collect the row.
 */
export async function disablePush(
	opts: { remote?: boolean } = {},
): Promise<PushState> {
	const reg = await serviceWorkerRegistration();
	const subscription = reg ? await reg.pushManager.getSubscription() : null;
	const endpoint = subscription?.endpoint;
	if (subscription) await subscription.unsubscribe().catch(() => undefined);
	if (opts.remote !== false && endpoint) {
		try {
			await api(
				`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`,
				{
					method: "DELETE",
				},
			);
		} catch (error) {
			return {
				kind: "error",
				message: `unsubscribed here, but the server still holds the endpoint: ${message(error)}`,
			};
		}
	}
	return { kind: "off" };
}

/**
 * The `pushsubscriptionchange` path: the worker has just dropped a subscription the push
 * service refused to renew, and re-subscribing needs no user gesture **because permission was
 * already granted** — which is exactly the condition this checks before doing anything. Calling
 * `enablePush()` here instead would mean a non-gesture `requestPermission()` for any user who
 * has since reset their permission, and a browser answers that with a silent "denied" that
 * sticks.
 */
export async function restorePush(): Promise<PushState> {
	if (typeof window === "undefined" || !("Notification" in window)) {
		return { kind: "unsupported", reason: "no notifications API" };
	}
	if (Notification.permission !== "granted") return { kind: "prompt" };
	return enablePush();
}

/**
 * Re-register a subscription the browser already holds — on mount (so a user who enabled
 * push last week is still enabled after a token change) and after the browser drops one
 * (see `pushsubscriptionchange` in `public/sw.js`). It never prompts.
 */
export async function syncPushSubscription(): Promise<PushState> {
	const state = await readPushState();
	if (state.kind !== "on") return state;
	const sub = await existing();
	const json = sub?.toJSON();
	if (!json?.endpoint || !json.keys?.p256dh || !json.keys.auth) return state;
	try {
		await api("/api/push/subscribe", {
			method: "POST",
			body: {
				endpoint: json.endpoint,
				p256dh: json.keys.p256dh,
				auth: json.keys.auth,
			},
		});
	} catch {
		// Nothing to surface: the local subscription is valid, and the next mount or
		// enable attempt retries. A user who is not looking at the notifications screen
		// has nobody to show an error to.
	}
	return state;
}

export type PushMessage =
	| { type: "fyk:inbox-dirty" }
	| { type: "fyk:push-resync" }
	| { type: "fyk:navigate"; href: string };

/**
 * The other half of the service worker's `postMessage` calls: the worker cannot use the
 * router (it has no document, no providers, and no session in the React sense), so it
 * asks a page to refetch, to re-subscribe, or to go somewhere.
 */
export function onPushMessage(
	handler: (message: PushMessage) => void,
): () => void {
	const listener = (event: MessageEvent) => {
		const data = event.data as PushMessage | undefined;
		if (!data || typeof data !== "object") return;
		if (
			data.type === "fyk:inbox-dirty" ||
			data.type === "fyk:push-resync" ||
			data.type === "fyk:navigate"
		) {
			handler(data);
		}
	};
	navigator.serviceWorker?.addEventListener("message", listener);
	return () =>
		navigator.serviceWorker?.removeEventListener("message", listener);
}

function message(error: unknown): string {
	if (error instanceof ApiError) return error.message;
	if (error instanceof Error) return error.message;
	return String(error);
}
