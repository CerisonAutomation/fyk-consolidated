/**
 * The client-safe façade for `#/lib/document-auth.server`.
 *
 * A route's `beforeLoad` runs in both runtimes, and Start's import protection
 * refuses to build a client module that reaches a `.server.ts` file — even
 * through a dynamic `import()`, which I tried first and which failed with
 * "this module is server-only" rather than silently shipping `getRequest()` to
 * the browser. `createIsomorphicFn` is the supported shape of the same intent:
 * the two branches are compiled into the bundles that can execute them, so the
 * server branch is the only one that can see the request context, and the
 * browser gets an explicit no-op instead of an accident.
 *
 * Why the client branch does nothing *and why that is not a hole*: the check is
 * about what the **server renders**. The browser has no credential to inspect and
 * every piece of private data it can display arrives through `/api/*`, which
 * verifies the caller per request and answers 401 without one. Moving the guard to
 * the client would mean trusting the client's own word about its session — the
 * pattern this repository spent §2.11 through §2.13 removing everywhere else.
 */

import { createIsomorphicFn } from "@tanstack/react-start";

export const requireDocumentSession = createIsomorphicFn()
	.client(() => Promise.resolve())
	.server(async () => {
		const { requireDocumentSession: guard } = await import(
			"#/lib/document-auth.server"
		);
		await guard();
	});
