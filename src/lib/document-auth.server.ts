/**
 * Session resolution for **HTML documents**, i.e. what a server render is
 * allowed to show before any JavaScript has run (AUDIT §3.3).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `/api/*` has verified its caller since `#/lib/supabase-auth.server` landed, so
 * a stranger could never read another user's rows. What nobody checked was the
 * *page*. `beforeLoad`/`loader` run during SSR, and the browser was the only
 * place that knew whether a session existed — which produced the specific
 * failure this closes:
 *
 *   - `GET /settings` answered `200` with the settings chrome, the account
 *     e-mail slot, the sign-out button and the delete-my-data row, all of them
 *     rendered as if for a signed-in visitor;
 *   - `GET /notifications` answered `200` with the inbox skeleton and a
 *     notification bell, and the fetch inside it was the first thing to learn
 *     that the request had no session;
 *   - `GET /safety` answered `200` with a live "arm a check-in" form. The
 *     submit 401s, so what an unauthenticated visitor got was a working-looking
 *     safety control that silently does nothing — the worst outcome a safety
 *     feature can have.
 *
 * It also made `src/components/auth-gate.tsx` a lie by implication: a component
 * named `AuthGate`, imported by no route, protecting nothing. That file is gone;
 * this is the gate.
 *
 * WHY IT COULD NOT EXIST BEFORE
 * -----------------------------
 * There was nothing to read. supabase-js persisted the session in
 * `localStorage`, which a document request does not carry. The browser client now
 * persists it in cookies (`#/integrations/supabase/client`), so the credential
 * the API verifies and the credential a render verifies are the same bytes,
 * parsed by the same function. That is the whole design: **one verification path,
 * two callers.** No second session implementation, no "trust the cookie because it
 * is named like a session" shortcut.
 *
 * DELIBERATE LIMITS
 * -----------------
 * 1. **The server never refreshes and never writes a cookie.** A render only
 *    verifies what the browser already has; rotating a refresh token mid-render is
 *    how a response gets cached with somebody else's `Set-Cookie` on it. Token
 *    renewal stays where it is already handled, by the browser client, which
 *    writes the cookie itself. A side benefit is that no document response here can
 *    be poisoned by a CDN: it sets no state.
 * 2. **`expired` renders instead of redirecting.** A validly-signed token whose
 *    `exp` has passed is a browser that is signed in and about to refresh, not a
 *    stranger. Bouncing it would log people out on every refresh race, and it leaks
 *    nothing: the document's data fetches all go through `/api/*`, which answers
 *    401 until the refreshed token arrives. `rejected` (bad signature, anon role)
 *    and `anonymous` are the cases that get redirected.
 * 3. **`unconfigured`, `unreachable` and demo mode render.** Without
 *    `SUPABASE_URL`/`SUPABASE_ANON_KEY` there is no project to ask — the sandbox
 *    preview and every `vite dev` without a `.env.local` — and a GoTrue that will
 *    not answer must not turn into "everyone is signed out". All three are
 *    fail-open *for the document only*; the API remains fail-closed, which is where
 *    the data actually is. `VITE_ENABLE_DEMO` is the in-browser dataset the README
 *    documents, and it deliberately has no session.
 *
 * SECURITY: server-only by filename (`.server.ts`), and it reads the request
 * context, which does not exist in the browser bundle. Call it from `beforeLoad`
 * behind a `typeof window` check, as the routes here do.
 */

import { redirect } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { demoEnabled } from "#/domains/demo";
import { logError } from "#/lib/logger";
import {
	type Caller,
	isAuthConfigured,
	type Verification,
	verifyRequest,
} from "#/lib/supabase-auth.server";

const SCOPE = "auth/document";

export type DocumentSession = {
	/** The verified caller, or `null` for anything that is not a signed-in user. */
	caller: Caller | null;
	status: Verification["status"];
	/** True when the render may show the signed-in surface. */
	render: boolean;
};

/**
 * Who is asking for this document, according to the cookies it carried.
 *
 * Returns `render: true` for the fail-open cases so the caller can decide what to
 * do with them; `requireDocumentSession` is what routes actually use.
 */
export async function documentSession(): Promise<DocumentSession> {
	let request: Request;
	try {
		request = getRequest();
	} catch (error) {
		// No request context: a prerender, a test, or a call from outside a
		// handler. There is no credential to check and nobody to bounce.
		logError(SCOPE, error, { stage: "no-request-context" });
		return { caller: null, status: "unconfigured", render: true };
	}

	if (demoEnabled)
		return { caller: null, status: "unconfigured", render: true };
	if (!isAuthConfigured()) {
		return { caller: null, status: "unconfigured", render: true };
	}

	const verification = await verifyRequest(request);
	switch (verification.status) {
		case "authenticated":
			return {
				caller: verification.caller,
				status: "authenticated",
				render: true,
			};
		case "expired":
		case "unreachable":
		case "unconfigured":
			return { caller: null, status: verification.status, render: true };
		default:
			// "anonymous" | "rejected"
			return { caller: null, status: verification.status, render: false };
	}
}

/**
 * `beforeLoad` for a route whose screen is private: render as the signed-in user,
 * or send the visitor to the sign-in page.
 *
 * The redirect is the document-level one TanStack emits — `307` to `/auth/sign-in`,
 * measured, not assumed — which is what makes the finding close: before this,
 * `curl /settings` got the page.
 */
export async function requireDocumentSession(): Promise<DocumentSession> {
	const session = await documentSession();
	// Deliberately not logged: every stranger who types the URL would be an error
	// line, and the same request is already refused with a 401 one hop away, in the
	// place that has the rate limiter and the caller id to make it meaningful.
	if (!session.render) throw redirect({ to: "/auth/sign-in" });
	return session;
}
