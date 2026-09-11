/**
 * Browser Supabase client.
 *
 * Sessions are stored in cookies via @supabase/ssr — not localStorage — for two
 * reasons that matter to this product:
 *   1. the FYK API reads the same cookie to authorize itself, so there is exactly
 *      one session and no client-asserted identity;
 *   2. a token in localStorage is readable by any injected script, and a dating
 *      app renders attacker-controlled text (bios, display names, messages).
 *
 * The client is used for auth + uploads only. Reads and writes go through the API,
 * where validation and authorization live.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { env } from "./env";

export type Client = SupabaseClient<Database>;

let instance: Client | null = null;

/** Null when the app is unconfigured; callers must render a setup state. */
export function getSupabase(): Client | null {
	if (!env) return null;
	if (instance) return instance;
	instance = createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
		isSingleton: false,
		cookieOptions: {
			// The session is stored in cookies so the server can read it on every
			// request; localStorage is never used, which removes the XSS token path.
			name: "fyk-auth",
			sameSite: "lax",
			secure: env.appEnv === "production",
			path: "/",
		},
		auth: {
			persistSession: true,
			detectSessionInUrl: true,
			autoRefreshToken: true,
			// PKCE is what makes the emailed link safe: the code in the URL is
			// useless without the verifier kept in this browser.
			flowType: "pkce",
		},
		global: { headers: { "x-client-info": "fyk-web" } },
	}) as unknown as Client;
	return instance;
}

export function requireSupabase(): Client {
	const client = getSupabase();
	if (!client) {
		throw new Error("Supabase is not configured. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
	}
	return client;
}

export type Failure = { ok: false; code: string; message: string };
export type Success<T> = { ok: true; data: T };
export type Result<T> = Success<T> | Failure;

const FRIENDLY: Record<string, string> = {
	"23505": "That already exists.",
	"23503": "That referenced item no longer exists.",
	"23514": "Those values aren't allowed.",
	"42501": "You don't have permission to do that.",
	PGRST116: "Not found.",
	PGRST301: "Your session expired. Please sign in again.",
	"22P02": "That value isn't in the right format.",
};

/** Raw Postgres errors leak schema details, so they are never surfaced verbatim. */
export function toFailure(error: unknown): Failure {
	const e = error as { code?: string; message?: string } | null;
	const code = e?.code ?? "unknown";
	if (import.meta.env.DEV && e?.message) return { ok: false, code, message: FRIENDLY[code] ?? e.message };
	return { ok: false, code, message: FRIENDLY[code] ?? "Something went wrong. Please try again." };
}

export const ok = <T,>(data: T): Success<T> => ({ ok: true, data });
export const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
