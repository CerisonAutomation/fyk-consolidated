/**
 * Server-side Supabase client bound to the caller's session cookie.
 *
 * This is the only place the FYK API obtains a database handle, which keeps the
 * authorization story auditable: the server never uses a privileged key. Every
 * query runs as the signed-in user under Postgres Row Level Security, so a
 * handler cannot read rows the caller could not read from the browser.
 */

import { type CookieOptions, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "#/integrations/supabase/types";
import { unauthorized } from "./errors";

const SERVER_URL = (
	process.env.SUPABASE_URL ??
	process.env.VITE_SUPABASE_URL ??
	""
).trim();
const SERVER_KEY = (
	process.env.SUPABASE_ANON_KEY ??
	process.env.VITE_SUPABASE_ANON_KEY ??
	""
).trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

export function serverConfigured(): boolean {
	return (
		/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(SERVER_URL) &&
		SERVER_KEY.length > 20
	);
}

/**
 * Guard against the most damaging misconfiguration: letting a privileged key
 * anywhere near the request path. The API is designed to work without one; if a
 * deployment really needs service-role writes they must live in a separate
 * trusted worker, not in this process.
 */
export function serviceKeyConfigured(): boolean {
	return (
		SERVICE_KEY.length > 20 && !SERVER_KEY.startsWith(SERVICE_KEY.slice(0, 12))
	);
}

/** Minimal cookie serializer: the options Supabase sets, plus HttpOnly. */
function serializeCookie(
	name: string,
	value: string,
	opts: CookieOptions,
): string {
	const parts = [
		`${name}=${encodeURIComponent(value)}`,
		`Path=${opts.path ?? "/"}`,
	];
	if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
	if (opts.expires)
		parts.push(`Expires=${new Date(opts.expires).toUTCString()}`);
	parts.push(
		`SameSite=${opts.sameSite === "strict" ? "Strict" : opts.sameSite === "none" ? "None" : "Lax"}`,
	);
	if (opts.secure) parts.push("Secure");
	parts.push("HttpOnly");
	return parts.join("; ");
}

/** Client scoped to the caller's access token (RLS applies). Null when signed out. */
export function createUserClient(
	headers: Headers,
	onSetCookie?: (setCookieHeader: string) => void,
): SupabaseClient<Database> | null {
	const auth = headers.get("authorization");
	const cookie = headers.get("cookie");

	if (auth?.toLowerCase().startsWith("bearer ")) {
		const token = auth.slice(7).trim();
		if (!token) return null;
		return createClient<Database>(SERVER_URL, SERVER_KEY, {
			global: { headers: { Authorization: `Bearer ${token}` } },
			auth: { persistSession: false, autoRefreshToken: false },
		});
	}

	if (!cookie) return null;
	return createServerClient<Database>(SERVER_URL, SERVER_KEY, {
		cookieOptions: {
			name: "fyk-auth",
			sameSite: "lax",
			secure: true,
			path: "/",
		},
		cookies: {
			getAll: () =>
				cookie.split(/; */).map((entry) => {
					const idx = entry.indexOf("=");
					if (idx < 0) return { name: entry.trim(), value: "" };
					return {
						name: entry.slice(0, idx).trim(),
						value: decodeURIComponent(entry.slice(idx + 1)),
					};
				}),
			setAll: (cookies) => {
				// Without this the refreshed token is dropped and the session decays
				// into a logout the user cannot explain.
				if (!onSetCookie) return;
				for (const entry of cookies)
					onSetCookie(
						serializeCookie(entry.name, entry.value, entry.options ?? {}),
					);
			},
		},
	});
}

export type Caller = {
	userId: string;
	email: string | null;
	role: "user" | "moderator" | "admin";
};

/**
 * Resolves the caller from the request. `profiles.role` (a database column, not a
 * client-provided header) decides moderation rights, so a browser cannot escalate
 * itself by tampering with anything.
 */
export async function resolveCaller(headers: Headers): Promise<Caller | null> {
	const client = createUserClient(headers);
	if (!client) return null;

	const { data, error } = await client.auth.getUser();
	if (error || !data.user) return null;

	const role = await readRole(client, data.user.id);
	return { userId: data.user.id, email: data.user.email ?? null, role };
}

async function readRole(
	client: SupabaseClient<Database>,
	userId: string,
): Promise<Caller["role"]> {
	// `profiles` is readable by its owner under RLS, so a user can only ever read
	// their own role row. Moderation rights are therefore never client-asserted.
	const { data, error } = await client
		.from("profiles")
		.select("id,role")
		.eq("id", userId)
		.maybeSingle();
	if (error || !data) return "user";
	const value = (data as { role?: string | null }).role;
	return value === "admin" || value === "moderator" ? value : "user";
}

export function requireCaller(headers: Headers): Promise<Caller> {
	return resolveCaller(headers).then((caller) => {
		if (!caller) throw unauthorized();
		return caller;
	});
}

export { serializeCookie };
