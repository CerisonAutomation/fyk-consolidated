/**
 * Supabase browser client — the single instance for the whole app.
 *
 * Session handling: tokens live in localStorage under a namespaced key and are
 * auto-refreshed. This is the standard SPA trade-off; it is XSS-exposed by
 * nature, which is why the app must never introduce `dangerouslySetInnerHTML`
 * or any other HTML injection sink. (Verified: currently zero such sinks.)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import type { Database } from "./types";

export type Client = SupabaseClient<Database>;

let instance: Client | null = null;

/** Returns null when the app is unconfigured, so callers must handle setup state. */
export function getSupabase(): Client | null {
  if (!env) return null;
  if (instance) return instance;

  instance = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "fyk.auth",
      flowType: "pkce",
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
