/**
 * Environment validation — fails loudly at boot rather than mysteriously at runtime.
 *
 * Only `VITE_`-prefixed variables exist here. Vite inlines those into the public
 * bundle, so nothing in this file may ever be secret. The anon key is public by
 * design: it grants exactly what Row Level Security allows and nothing more.
 *
 * The service-role key must NEVER appear in this file, in `src/`, or anywhere
 * reachable by the browser.
 */

export type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appEnv: "development" | "staging" | "production";
};

export class EnvError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `Missing or invalid environment variables: ${missing.join(", ")}.\n` +
        `Copy .env.example to .env.local and fill in the values.`,
    );
    this.name = "EnvError";
  }
}

function read(): { env: AppEnv | null; missing: string[] } {
  const raw = import.meta.env;
  const url = (raw.VITE_SUPABASE_URL ?? "").trim();
  const key = (raw.VITE_SUPABASE_ANON_KEY ?? "").trim();
  const missing: string[] = [];

  if (!url) missing.push("VITE_SUPABASE_URL");
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    missing.push("VITE_SUPABASE_URL (must be https://<ref>.supabase.co)");
  }

  if (!key) missing.push("VITE_SUPABASE_ANON_KEY");

  // Guard against the single most damaging config mistake: shipping a
  // service-role key to the browser. Detect both the legacy JWT and new format.
  if (key) {
    const isServiceRole =
      key.startsWith("sb_secret_") ||
      (() => {
        try {
          const part = key.split(".")[1];
          if (!part) return false;
          const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
          return payload?.role === "service_role";
        } catch {
          return false;
        }
      })();
    if (isServiceRole) {
      throw new Error(
        "FATAL: a service_role key was supplied to the browser client. " +
          "This key bypasses all Row Level Security. Remove it from .env.local " +
          "and rotate it immediately in the Supabase dashboard.",
      );
    }
  }

  if (missing.length) return { env: null, missing };

  const appEnv = (raw.VITE_APP_ENV ?? "development") as AppEnv["appEnv"];

  return {
    env: {
      supabaseUrl: url,
      supabaseAnonKey: key,
      appEnv: ["development", "staging", "production"].includes(appEnv) ? appEnv : "development",
    },
    missing: [],
  };
}

const result = read();

/** Null when config is absent — the app renders a setup screen instead of crashing. */
export const env: AppEnv | null = result.env;
export const envMissing: string[] = result.missing;
export const isConfigured = env !== null;
