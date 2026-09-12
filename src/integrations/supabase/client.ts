/**
 * Supabase browser client — the single instance for the whole app.
 *
 * Session handling: the session is persisted in **cookies**, by
 * `@supabase/ssr`'s browser client, and auto-refreshed here in the browser.
 *
 * WHY COOKIES AND NOT localStorage
 * --------------------------------
 * `createClient` from `supabase-js` (what this file used) persists to
 * `localStorage["fyk.auth"]`, which the server cannot see. That is not a style
 * preference, it is what made server-side auth impossible: a document request
 * for `/settings` carried no credential at all, so SSR could only render the
 * page as signed-out and the *browser* had to decide a moment later that it
 * should not have (the `#/lib/supabase-auth.server` cookie branch had a reader
 * with no writer). With the session in a cookie, `getRequest()` →
 * `bearerToken()` finds the same credential the API routes verify, so one
 * verification path covers both `/api/*` and the HTML document
 * (`#/lib/document-auth.server`, `beforeLoad`).
 *
 * What this does *not* buy: these cookies are not `HttpOnly`, because the
 * browser client has to read them — so an XSS payload can still exfiltrate a
 * session. The exposure is the same one the header of this file used to call
 * "the standard SPA trade-off"; it moved from `localStorage` to a cookie, not
 * away from script-readable storage. What changed is that the *server* can now
 * tell whether a request is authenticated, and that cross-site writes are
 * refused: mutating `/api/*` calls run `assertSameOrigin` inside
 * `#/middleware#withSecurity` for every method (see `#/lib/security.ts` for the
 * CSP that keeps the XSS part hypothetical, and AUDIT §3.4 for what is still
 * open there).
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import type { Database } from "./types";

export type Client = SupabaseClient<Database>;

let instance: Client | null = null;

/** Returns null when the app is unconfigured, so callers must handle setup state. */
export function getSupabase(): Client | null {
  if (!env) return null;
  if (instance) return instance;

  // `secure` is derived from the *origin the page is served from*, not from
  // `env.appEnv`: an http://localhost preview must not get a `Secure` cookie the
  // browser will silently drop (that failure looks exactly like "sessions do not
  // persist"), while any real deployment is https and gets it.
  const secure =
    typeof location !== "undefined" && location.protocol === "https:";

  instance = createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "fyk.auth",
      flowType: "pkce",
    },
    // No `cookieOptions.name`: the library default is `sb-<ref>-auth-token`, and
    // `bearerToken()` on the server matches that family by pattern
    // (`sb-*auth*`, chunk suffixes included) instead of pinning a string, so
    // neither side can rename the cookie out from under the other.
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure,
      // The library sets the expiry from the session itself; `maxAge` is only a
      // ceiling for the *refresh* cookie so a stale session cookie cannot outlive
      // a revocation by months. `#/lib/document-auth.server` treats an expired
      // access token as "let the browser refresh", not as a signed-out user.
      maxAge: 60 * 60 * 24 * 30,
    },
    global: {
      headers: { "x-client-info": "fyk-web" },
    },
    db: { schema: "public" },
  });

  return instance;
}

/** For call sites that genuinely cannot proceed without a client. */
export function requireSupabase(): Client {
  const c = getSupabase();
  if (!c) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return c;
}

/* ------------------------------ error shaping ---------------------------- */

export type Failure = { ok: false; code: string; message: string };
export type Success<T> = { ok: true; data: T };
export type Result<T> = Success<T> | Failure;

/**
 * Converts Postgres/PostgREST errors into messages safe to show a user.
 * Raw database errors leak schema details, so they are never surfaced verbatim.
 */
export function toFailure(error: unknown): Failure {
  const e = error as { code?: string; message?: string; status?: number } | null;
  const code = e?.code ?? "unknown";

  const friendly: Record<string, string> = {
    "23505": "That already exists.",
    "23503": "That referenced item no longer exists.",
    "23514": "Those values aren't allowed.",
    "42501": "You don't have permission to do that.",
    PGRST116: "Not found.",
    PGRST301: "Your session expired. Please sign in again.",
    "22P02": "That value isn't in the right format.",
  };

  if (import.meta.env.DEV && e?.message) {
    // Full detail in development only.
    return { ok: false, code, message: friendly[code] ?? e.message };
  }
  return { ok: false, code, message: friendly[code] ?? "Something went wrong. Please try again." };
}

export const ok = <T,>(data: T): Success<T> => ({ ok: true, data });
export const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
