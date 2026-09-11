import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { LogoHorizontal } from "./Brand";
import { cn } from "@/utils/cn";
import { px } from "@/lib/data";
import { envMissing, isConfigured } from "@/lib/supabase/env";
import { getSupabase, toFailure } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

// --- Zod schemas for form validation (per react-forms.md docs) ---

const authSchema = z.object({
  email: z.string().min(1, "Enter your email address.").email("Please enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters for your password."),
});

const authForgotSchema = z.object({
  email: z.string().min(1, "Enter your email address.").email("Please enter a valid email address."),
});

const authSignupSchema = z.object({
  email: z.string().min(1, "Enter your email address.").email("Please enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters for your password."),
  adult: z.boolean().refine((v) => v === true, "You must confirm you are 18+."),
  legal: z.boolean().refine((v) => v === true, "You must accept the Terms and Privacy Policy."),
});

const passwordUpdateSchema = z.object({
  password: z.string().min(10, "Use at least 10 characters."),
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
  message: "The passwords do not match.",
  path: ["confirm"],
});

type AuthState = {
  user: User;
  session: Session;
  profile: Profile;
  readiness: BackendReadiness;
  updateProfile: (changes: Partial<Profile>) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
};

export type BackendReadiness = {
  coreProfile: boolean;
  board: boolean;
  social: boolean;
  chat: boolean;
  chatMediaStorage: boolean;
  albumStorage: boolean;
  avatarStorage: boolean;
  missing: string[];
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside EntryShell");
  return value;
}

type GateState =
  | { kind: "loading" }
  | { kind: "setup"; reason: string; missing: string[] }
  | { kind: "signed-out" }
  | { kind: "signed-in"; session: Session; profile: Profile | null; readiness: BackendReadiness };

const PROFILE_COLUMNS =
  "id,handle,display_name,avatar_url,bio,headline,age,age_verified_at,city,area,lat_coarse,lng_coarse,exposure_level,height_cm,body_type,position_role,pronouns,hide_distance,hide_online,incognito,is_demo,is_suspended,onboarding_completed_at,last_active_at,created_at,updated_at";

function friendlySchemaError(message: string) {
  if (/column|relation|schema cache|does not exist/i.test(message)) {
    return "The Supabase project is connected, but the FYKING MVP schema has not been applied yet.";
  }
  return "FYKING can reach Supabase, but the data layer is not ready for authenticated use.";
}

async function inspectBackend(userId?: string): Promise<BackendReadiness> {
  const client = getSupabase();
  if (!client) {
    return { coreProfile: false, board: false, social: false, chat: false, chatMediaStorage: false, albumStorage: false, avatarStorage: false, missing: ["Supabase client configuration"] };
  }

  const [profile, privateProfile, posts, comments, joins, likes, matches, conversations, messages, attachments, shares, reactions, albums, albumItems] = await Promise.all([
    client.from("profiles").select("id,handle,age_verified_at,exposure_level,onboarding_completed_at").limit(1),
    client.from("profile_private").select("id").limit(1),
    client.from("board_posts").select("id,author_id,expires_at").limit(1),
    client.from("board_comments").select("id,post_id,author_id").limit(1),
    client.from("post_joins").select("post_id,profile_id").limit(1),
    client.from("likes").select("id,from_id,to_id,kind").limit(1),
    client.from("matches").select("id,user_a,user_b,unmatched_at").limit(1),
    client.from("conversations").select("id,last_message_at").limit(1),
    client.from("messages").select("id,conversation_id,album_share_id").limit(1),
    client.from("message_attachments").select("id,message_id,access_policy,status").limit(1),
    client.from("album_shares").select("id,album_id,access_policy,status").limit(1),
    client.from("message_reactions").select("message_id,profile_id,emoji").limit(1),
    client.from("private_albums").select("id,owner_id,default_access_policy").limit(1),
    client.from("private_album_items").select("id,album_id,media_kind").limit(1),
  ]);

  const missing: string[] = [];
  if (profile.error) missing.push("profiles columns from 001_schema.sql");
  if (privateProfile.error) missing.push("profile_private table for date of birth");
  if (posts.error) missing.push("board_posts table");
  if (comments.error) missing.push("board_comments table");
  if (joins.error) missing.push("post_joins table");
  if (likes.error) missing.push("likes table or authenticated policies");
  if (matches.error) missing.push("matches table or mutual-like trigger policies");
  if (conversations.error) missing.push("conversations table or member policy");
  if (messages.error) missing.push("messages.album_share_id from 004_chat_media.sql");
  if (attachments.error) missing.push("message_attachments from 004_chat_media.sql");
  if (shares.error) missing.push("album_shares from 004_chat_media.sql");
  if (reactions.error) missing.push("message_reactions from 004_chat_media.sql");
  if (albums.error) missing.push("private_albums from 004_chat_media.sql");
  if (albumItems.error) missing.push("private_album_items album columns from 004_chat_media.sql");

  let avatarStorage = false;
  let chatMediaStorage = false;
  let albumStorage = false;
  if (userId) {
    const [avatarBucket, chatBucket, albumBucket] = await Promise.all([
      client.storage.from("avatars-public").list(userId, { limit: 1 }),
      client.storage.from("chat-media-private").list("", { limit: 1 }),
      client.storage.from("albums-private").list(userId, { limit: 1 }),
    ]);
    avatarStorage = !avatarBucket.error;
    chatMediaStorage = !chatBucket.error;
    albumStorage = !albumBucket.error;
    if (avatarBucket.error) missing.push("avatars-public bucket or authenticated storage policy");
    if (chatBucket.error) missing.push("chat-media-private bucket or fyk_chat_* policies");
    if (albumBucket.error) missing.push("albums-private bucket or fyk_album_* policies");
  }

  return {
    coreProfile: !profile.error && !privateProfile.error,
    board: !posts.error && !comments.error && !joins.error,
    social: !likes.error && !matches.error,
    chat: !conversations.error && !messages.error && !attachments.error && !shares.error && !reactions.error && !albums.error && !albumItems.error,
    chatMediaStorage: userId ? chatMediaStorage : true,
    albumStorage: userId ? albumStorage : true,
    avatarStorage: userId ? avatarStorage : true,
    missing,
  };
}

/**
 * Hard auth boundary for the existing SPA. When Supabase is configured there is
 * no seed-account fallback: signed-out users see auth, and incomplete projects
 * see an explicit setup state instead of a fake signed-in identity.
 */
export function EntryShell({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<GateState>({ kind: "loading" });
  const [recovering, setRecovering] = useState(false);

  const load = useCallback(async () => {
    if (!isConfigured) {
      setGate({ kind: "setup", reason: `Missing ${envMissing.join(" and ")}.`, missing: envMissing });
      return;
    }

    const client = getSupabase();
    if (!client) {
      setGate({ kind: "setup", reason: "The Supabase browser client could not be created.", missing: ["Supabase client"] });
      return;
    }

    setGate({ kind: "loading" });

    const publicReadiness = await inspectBackend();
    if (!publicReadiness.coreProfile) {
      setGate({
        kind: "setup",
        reason: "The Supabase project is connected, but the profile schema required for auth and onboarding is incomplete.",
        missing: publicReadiness.missing,
      });
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      setGate({ kind: "setup", reason: "Session restore failed. Check the Supabase URL and anon key.", missing: ["Valid auth session"] });
      return;
    }
    if (!data.session) {
      setGate({ kind: "signed-out" });
      return;
    }

    const profileResult = await client
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", data.session.user.id)
      .maybeSingle();

    if (profileResult.error) {
      setGate({ kind: "setup", reason: friendlySchemaError(profileResult.error.message), missing: ["Readable authenticated profile"] });
      return;
    }

    const readiness = await inspectBackend(data.session.user.id);
    setGate({ kind: "signed-in", session: data.session, profile: profileResult.data, readiness });
  }, []);

  useEffect(() => {
    void load();
    const client = getSupabase();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
        return;
      }
      // Defer the query so it never contends with Supabase's auth-state lock.
      window.setTimeout(() => void load(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  if (recovering) {
    return (
      <PasswordUpdate
        onComplete={async () => {
          setRecovering(false);
          await getSupabase()?.auth.signOut({ scope: "local" });
          await load();
        }}
      />
    );
  }
  if (gate.kind === "loading") return <EntryLoading />;
  if (gate.kind === "setup") return <SetupRequired reason={gate.reason} missing={gate.missing} onRetry={() => void load()} />;
  if (gate.kind === "signed-out") return <SignedOut />;
  if (!gate.profile?.onboarding_completed_at || !gate.profile.age_verified_at) {
    return <Onboarding session={gate.session} initial={gate.profile} onComplete={() => void load()} />;
  }

  const profile = gate.profile;
  const session = gate.session;

  return (
    <AuthenticatedBoundary profile={profile} session={session} readiness={gate.readiness} onReload={load}>
      {children}
    </AuthenticatedBoundary>
  );
}

function AuthenticatedBoundary({
  profile,
  session,
  readiness,
  onReload,
  children,
}: {
  profile: Profile;
  session: Session;
  readiness: BackendReadiness;
  onReload: () => Promise<void>;
  children: ReactNode;
}) {
  const updateProfile = useCallback(
    async (changes: Partial<Profile>) => {
      const client = getSupabase();
      if (!client) return { ok: false, message: "Supabase is not configured." };
      const { error } = await client.from("profiles").update(changes).eq("id", session.user.id);
      if (error) return { ok: false, message: toFailure(error).message };
      await onReload();
      return { ok: true };
    },
    [onReload, session.user.id],
  );

  const signOut = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    await client.auth.signOut({ scope: "local" });
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user: session.user, session, profile, readiness, updateProfile, signOut }),
    [profile, readiness, session, signOut, updateProfile],
  );

  // React 19: render <Context> directly as a provider instead of <Context.Provider>
  return <AuthContext value={value}>{children}</AuthContext>;
}

function EntryLoading() {
  return (
    <div className="grid min-h-[100svh] place-items-center bg-canvas px-6 text-ink">
      <div className="flex flex-col items-center gap-5">
        <LogoHorizontal className="w-52" />
        <span className="inline-flex items-center gap-2 text-[13px] font-medium text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-gold" />
          Restoring your private session
        </span>
      </div>
    </div>
  );
}

function SetupRequired({ reason, missing, onRetry }: { reason: string; missing: string[]; onRetry: () => void }) {
  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-canvas text-ink">
      <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_18%_18%,rgba(232,179,75,.18),transparent_34%),radial-gradient(circle_at_82%_80%,rgba(124,92,255,.12),transparent_32%)]" />
      <main className="relative mx-auto flex min-h-[100svh] max-w-5xl items-center px-5 py-12 sm:px-8">
        <div className="max-w-2xl">
          <LogoHorizontal className="w-64 sm:w-80" />
          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.24em] text-gold">Setup required</p>
          <h1 className="mt-3 text-[36px] font-bold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[52px]">
            The app is connected. The data layer is not ready yet.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">{reason}</p>
          {missing.length > 0 && (
            <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-faint">Missing or inaccessible</p>
              <ul className="mt-2 space-y-1.5">
                {missing.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-ink-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-live" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-7 border-l-2 border-gold pl-5">
            <p className="text-[14px] font-semibold text-ink">Run these in the Supabase SQL Editor, in order:</p>
            <ol className="mt-2 space-y-1 font-mono text-[13px] text-muted">
              <li>1. supabase/migrations/001_schema.sql</li>
              <li>2. supabase/migrations/002_rls.sql</li>
              <li>3. supabase/migrations/003_storage.sql</li>
            </ol>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="press inline-flex h-12 items-center gap-2 rounded-full bg-gold px-6 text-[14px] font-bold text-black hover:bg-gold-2"
            >
              <RefreshCw className="h-4 w-4" />
              Check again
            </button>
            <button
              type="button"
              onClick={() => void getSupabase()?.auth.signOut({ scope: "local" }).then(onRetry)}
              className="press inline-flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-5 text-[14px] font-semibold text-ink-2 hover:text-ink"
            >
              Clear local session
            </button>
          </div>
          <p className="mt-5 max-w-xl text-[12.5px] leading-relaxed text-faint">
            FYKING will not fall back to a demo account while Supabase is configured. This prevents sample profiles,
            local paywalls and browser-only privacy controls from being mistaken for real user data.
          </p>
        </div>
      </main>
    </div>
  );
}

type AuthMode = "signin" | "signup" | "forgot";

/**
 * SignedOut component — now uses react-hook-form + zod for validation
 * per the react-forms.md docs: "use zodResolver for type-safe validation".
 */
function SignedOut() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Sign-in form
  const signinForm = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    mode: "onBlur",
  });

  // Sign-up form
  const signupForm = useForm<z.infer<typeof authSignupSchema>>({
    resolver: zodResolver(authSignupSchema),
    mode: "onBlur",
    defaultValues: { adult: false, legal: false },
  });

  // Forgot form
  const forgotForm = useForm<z.infer<typeof authForgotSchema>>({
    resolver: zodResolver(authForgotSchema),
    mode: "onBlur",
  });

  const [showPassword, setShowPassword] = useState(false);

  const submitSignIn = async (data: z.infer<typeof authSchema>) => {
    const client = getSupabase();
    if (!client) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { error: authError } = await client.auth.signInWithPassword({ email: data.email.trim(), password: data.password });
      if (authError) setError("We couldn't sign you in. Check your details or confirm your email first.");
    } finally {
      setBusy(false);
    }
  };

  const submitSignUp = async (data: z.infer<typeof authSignupSchema>) => {
    const client = getSupabase();
    if (!client) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { data: result, error: authError } = await client.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (authError) setError(toFailure(authError).message);
      else if (!result.session) setNotice("Check your inbox to confirm your email, then come back and sign in.");
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async (data: z.infer<typeof authForgotSchema>) => {
    const client = getSupabase();
    if (!client) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { error: authError } = await client.auth.resetPasswordForEmail(data.email.trim(), {
        redirectTo: window.location.origin,
      });
      if (authError) setError(toFailure(authError).message);
      else setNotice("If that address has an account, a reset link is on its way.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#07080a] text-white">
      <img
        src={px(15141201, 1900, 1300)}
        alt=""
        width={1900}
        height={1300}
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,8,.96)_0%,rgba(5,6,8,.78)_48%,rgba(5,6,8,.42)_100%)]" />
      <main className="relative mx-auto grid min-h-[100svh] max-w-7xl items-center gap-10 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_410px] lg:px-10">
        <section className="max-w-2xl pt-4 lg:pt-0">
          <LogoHorizontal className="w-64 sm:w-[340px]" />
          <h1 className="mt-9 text-[42px] font-bold leading-[1.01] tracking-[-0.045em] sm:text-[64px]">
            Find the people who fit your night.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/68 sm:text-[18px]">
            Nearby, chat, private albums, events and spontaneous plans. One adults-only place for a date, a beach
            day, a coffee or something more direct.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-[13px] font-medium text-white/62">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold" /> 18+ only</span>
            <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" /> Approximate location by default</span>
            <span className="inline-flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-gold" /> Supabase session</span>
          </div>
        </section>

        <section className="rounded-[24px] border border-white/12 bg-black/48 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="mb-6 flex gap-1 rounded-full border border-white/10 bg-white/[0.05] p-1">
            {(["signin", "signup"] as AuthMode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError("");
                  setNotice("");
                }}
                className={cn(
                  "press flex-1 rounded-full py-2.5 text-[13.5px] font-semibold",
                  mode === item ? "bg-white text-black" : "text-white/60 hover:text-white",
                )}
              >
                {item === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
              {mode === "forgot" ? "Account recovery" : mode === "signin" ? "Welcome back" : "Private beta"}
            </p>
            <h2 className="mt-2 text-[27px] font-bold tracking-[-0.025em]">
              {mode === "forgot" ? "Reset your password" : mode === "signin" ? "Your people are waiting" : "Start with the real you"}
            </h2>
          </div>

          {/* Sign-in form with react-hook-form + zod */}
          {mode === "signin" && (
            <form onSubmit={signinForm.handleSubmit(submitSignIn)} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-white/72">Email</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                  <input
                    type="email"
                    autoComplete="email"
                    {...signinForm.register("email")}
                    className={cn(
                      "h-12 w-full rounded-xl border bg-white/[0.06] pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-white/30 focus:border-gold/70",
                      signinForm.formState.errors.email ? "border-live/50" : "border-white/12",
                    )}
                    placeholder="you@example.com"
                    aria-invalid={signinForm.formState.errors.email ? "true" : "false"}
                  />
                </span>
                {signinForm.formState.errors.email && (
                  <p className="mt-1 text-[12px] text-live" role="alert">{signinForm.formState.errors.email.message}</p>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-white/72">Password</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    {...signinForm.register("password")}
                    className={cn(
                      "h-12 w-full rounded-xl border bg-white/[0.06] pl-10 pr-11 text-[14px] outline-none transition-colors placeholder:text-white/30 focus:border-gold/70",
                      signinForm.formState.errors.password ? "border-live/50" : "border-white/12",
                    )}
                    placeholder="Your password"
                    aria-invalid={signinForm.formState.errors.password ? "true" : "false"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="press absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-white/45 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
                {signinForm.formState.errors.password && (
                  <p className="mt-1 text-[12px] text-live" role="alert">{signinForm.formState.errors.password.message}</p>
                )}
              </label>

              {error && <p role="alert" className="rounded-xl border border-live/35 bg-live/12 px-3.5 py-3 text-[13px] text-[#ff9aa6]">{error}</p>}
              {notice && <p role="status" className="rounded-xl border border-online/35 bg-online/10 px-3.5 py-3 text-[13px] text-[#8ee2b4]">{notice}</p>}

              <button
                type="submit"
                disabled={busy}
                className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2 disabled:opacity-55"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Sign in
              </button>
            </form>
          )}

          {/* Sign-up form with react-hook-form + zod */}
          {mode === "signup" && (
            <form onSubmit={signupForm.handleSubmit(submitSignUp)} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-white/72">Email</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                  <input
                    type="email"
                    autoComplete="email"
                    {...signupForm.register("email")}
                    className={cn(
                      "h-12 w-full rounded-xl border bg-white/[0.06] pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-white/30 focus:border-gold/70",
                      signupForm.formState.errors.email ? "border-live/50" : "border-white/12",
                    )}
                    placeholder="you@example.com"
                    aria-invalid={signupForm.formState.errors.email ? "true" : "false"}
                  />
                </span>
                {signupForm.formState.errors.email && (
                  <p className="mt-1 text-[12px] text-live" role="alert">{signupForm.formState.errors.email.message}</p>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-white/72">Password</span>
                <span className="relative block">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...signupForm.register("password")}
                    className={cn(
                      "h-12 w-full rounded-xl border bg-white/[0.06] pl-10 pr-11 text-[14px] outline-none transition-colors placeholder:text-white/30 focus:border-gold/70",
                      signupForm.formState.errors.password ? "border-live/50" : "border-white/12",
                    )}
                    placeholder="10+ characters"
                    aria-invalid={signupForm.formState.errors.password ? "true" : "false"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="press absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-white/45 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
                {signupForm.formState.errors.password && (
                  <p className="mt-1 text-[12px] text-live" role="alert">{signupForm.formState.errors.password.message}</p>
                )}
              </label>

              <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                <label className="flex cursor-pointer items-start gap-3 text-[12.5px] leading-relaxed text-white/68">
                  <input
                    type="checkbox"
                    {...signupForm.register("adult")}
                    className="mt-0.5 h-4 w-4 accent-[var(--c-gold)]"
                  />
                  I confirm I am at least 18 years old.
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-[12.5px] leading-relaxed text-white/68">
                  <input
                    type="checkbox"
                    {...signupForm.register("legal")}
                    className="mt-0.5 h-4 w-4 accent-[var(--c-gold)]"
                  />
                  I accept the Terms and Privacy Policy.
                </label>
                {(signupForm.formState.errors.adult || signupForm.formState.errors.legal) && (
                  <p className="text-[12px] text-live" role="alert">
                    {signupForm.formState.errors.adult?.message || signupForm.formState.errors.legal?.message}
                  </p>
                )}
              </div>

              {error && <p role="alert" className="rounded-xl border border-live/35 bg-live/12 px-3.5 py-3 text-[13px] text-[#ff9aa6]">{error}</p>}
              {notice && <p role="status" className="rounded-xl border border-online/35 bg-online/10 px-3.5 py-3 text-[13px] text-[#8ee2b4]">{notice}</p>}

              <button
                type="submit"
                disabled={busy}
                className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2 disabled:opacity-55"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Create account
              </button>
            </form>
          )}

          {/* Forgot password form with react-hook-form + zod */}
          {mode === "forgot" && (
            <form onSubmit={forgotForm.handleSubmit(submitForgot)} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-white/72">Email</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                  <input
                    type="email"
                    autoComplete="email"
                    {...forgotForm.register("email")}
                    className={cn(
                      "h-12 w-full rounded-xl border bg-white/[0.06] pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-white/30 focus:border-gold/70",
                      forgotForm.formState.errors.email ? "border-live/50" : "border-white/12",
                    )}
                    placeholder="you@example.com"
                    aria-invalid={forgotForm.formState.errors.email ? "true" : "false"}
                  />
                </span>
                {forgotForm.formState.errors.email && (
                  <p className="mt-1 text-[12px] text-live" role="alert">{forgotForm.formState.errors.email.message}</p>
                )}
              </label>

              {error && <p role="alert" className="rounded-xl border border-live/35 bg-live/12 px-3.5 py-3 text-[13px] text-[#ff9aa6]">{error}</p>}
              {notice && <p role="status" className="rounded-xl border border-online/35 bg-online/10 px-3.5 py-3 text-[13px] text-[#8ee2b4]">{notice}</p>}

              <button
                type="submit"
                disabled={busy}
                className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2 disabled:opacity-55"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Send reset link
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => {
              setMode(mode === "forgot" ? "signin" : "forgot");
              setError("");
              setNotice("");
            }}
            className="press mt-4 w-full text-center text-[12.5px] font-medium text-white/52 hover:text-white"
          >
            {mode === "forgot" ? "Back to sign in" : "Forgot your password?"}
          </button>
        </section>
      </main>
    </div>
  );
}

function PasswordUpdate({ onComplete }: { onComplete: () => Promise<void> }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof passwordUpdateSchema>>({
    resolver: zodResolver(passwordUpdateSchema),
    mode: "onBlur",
  });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (data: z.infer<typeof passwordUpdateSchema>) => {
    const client = getSupabase();
    if (!client) return;
    setBusy(true);
    setError("");
    const { error: updateError } = await client.auth.updateUser({ password: data.password });
    setBusy(false);
    if (updateError) {
      setError(toFailure(updateError).message);
      return;
    }
    await onComplete();
  };

  return (
    <div className="grid min-h-[100svh] place-items-center bg-canvas px-5 py-10 text-ink">
      <main className="w-full max-w-md rounded-[24px] border border-line bg-surface p-6 shadow-[var(--shadow-pop)] sm:p-8">
        <LogoHorizontal className="w-52" />
        <span className="mt-8 grid h-11 w-11 place-items-center rounded-2xl bg-gold-ghost text-gold">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-[29px] font-bold tracking-[-0.03em]">Choose a new password</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          This recovery session came from your Supabase email link. After updating, you will sign in again with the new password.
        </p>
        <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
          <Field label="New password" error={errors.password?.message}>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                {...register("password")}
                className={cn("entry-input pr-11", errors.password && "border-live/50")}
                aria-invalid={errors.password ? "true" : "false"}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="press absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="Confirm password" error={errors.confirm?.message}>
            <input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              {...register("confirm")}
              className={cn("entry-input", errors.confirm && "border-live/50")}
              aria-invalid={errors.confirm ? "true" : "false"}
            />
          </Field>
          {error && <p role="alert" className="text-[13px] text-live">{error}</p>}
          <button type="submit" disabled={busy} className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2 disabled:opacity-55">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Update password
          </button>
        </form>
      </main>
    </div>
  );
}

function Onboarding({ session, initial, onComplete }: { session: Session; initial: Profile | null; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [city, setCity] = useState(initial?.city ?? "Valletta");
  const [dob, setDob] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const maxDob = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().slice(0, 10);
  }, []);

  const age = useMemo(() => {
    if (!dob) return 0;
    const birth = new Date(`${dob}T00:00:00`);
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const beforeBirthday =
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    if (beforeBirthday) years -= 1;
    return years;
  }, [dob]);

  const next = () => {
    setError("");
    if (displayName.trim().length < 2) return setError("Use at least 2 characters for your display name.");
    if (!/^[a-z0-9_]{3,24}$/.test(handle.trim().toLowerCase())) return setError("Handle must be 3-24 letters, numbers or underscores.");
    if (!dob || dob > maxDob || age < 18) return setError("FYKING is for adults aged 18 and over.");
    if (!city.trim()) return setError("Choose your city.");
    setStep(2);
  };

  const finish = async () => {
    if (!confirmed) {
      setError("Confirm the adult-content and privacy defaults before continuing.");
      return;
    }
    const client = getSupabase();
    if (!client) return;
    setBusy(true);
    setError("");
    const now = new Date().toISOString();
    const privateResult = await client.from("profile_private").upsert({
      id: session.user.id,
      dob,
      updated_at: now,
    });
    if (privateResult.error) {
      setBusy(false);
      setError(toFailure(privateResult.error).message);
      return;
    }

    const { error: saveError } = await client.from("profiles").upsert({
      id: session.user.id,
      display_name: displayName.trim(),
      handle: handle.trim().toLowerCase(),
      city: city.trim(),
      age,
      age_verified_at: now,
      exposure_level: "clean",
      hide_distance: false,
      hide_online: false,
      incognito: false,
      onboarding_completed_at: now,
      last_active_at: now,
      updated_at: now,
    });
    setBusy(false);
    if (saveError) {
      setError(toFailure(saveError).message);
      return;
    }
    onComplete();
  };

  return (
    <div className="min-h-[100svh] bg-canvas text-ink">
      <main className="mx-auto flex min-h-[100svh] max-w-6xl flex-col px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <LogoHorizontal className="w-48 sm:w-60" />
          <span className="text-[12px] font-semibold text-muted">Step {step} of 2</span>
        </div>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-gold transition-[width] duration-300" style={{ width: `${step * 50}%` }} />
        </div>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,470px)]">
          <section className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold">Your space, your pace</p>
            <h1 className="mt-3 text-[38px] font-bold leading-[1.04] tracking-[-0.04em] sm:text-[54px]">
              {step === 1 ? "Start with what people should know." : "Privacy starts conservative."}
            </h1>
            <p className="mt-5 text-[16px] leading-relaxed text-muted">
              {step === 1
                ? "A real profile begins with a real age gate. Your date of birth stays private; the app derives and shows only your age."
                : "Mature and explicit discovery starts off. Location stays approximate. You can change either later, but neither is enabled for you silently."}
            </p>
          </section>

          <section className="rounded-[22px] border border-line bg-surface p-5 shadow-[var(--shadow-pop)] sm:p-7">
            {step === 1 ? (
              <div className="space-y-4">
                <Field label="Display name">
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" placeholder="What people call you" className="entry-input" />
                </Field>
                <Field label="Handle">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
                    <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="your_handle" className="entry-input pl-8" />
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Date of birth">
                    <input type="date" value={dob} max={maxDob} onChange={(e) => setDob(e.target.value)} className="entry-input" />
                  </Field>
                  <Field label="City">
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Valletta" className="entry-input" />
                  </Field>
                </div>
                <p className="text-[12px] leading-relaxed text-faint">Your birth date is used for the 18+ gate. Other members see only your derived age.</p>
                {error && <p role="alert" className="text-[13px] text-live">{error}</p>}
                <button type="button" onClick={next} className="press flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="space-y-3">
                  {[
                    [ShieldCheck, "Content starts Clean", "Mature tags and media stay hidden until you opt in."],
                    [MapPin, "Distance stays approximate", "The app stores only a deliberately coarsened location."],
                    [LockKeyhole, "Your controls are yours", "Block, report and album access are designed for server policies."],
                  ].map(([Icon, title, body]) => {
                    const ItemIcon = Icon as typeof ShieldCheck;
                    return (
                      <div key={title as string} className="flex gap-3 border-b border-line-soft pb-3 last:border-0">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold-ghost text-gold"><ItemIcon className="h-4 w-4" /></span>
                        <div><p className="text-[13.5px] font-semibold text-ink">{title as string}</p><p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{body as string}</p></div>
                      </div>
                    );
                  })}
                </div>
                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--c-gold)]" />
                  <span className="text-[12.5px] leading-relaxed text-ink-2">I confirm I am 18+ and understand that FYKING includes optional adult-oriented discovery and media controls.</span>
                </label>
                {error && <p role="alert" className="mt-3 text-[13px] text-live">{error}</p>}
                <div className="mt-5 flex gap-2">
                  <button type="button" onClick={() => setStep(1)} className="press h-12 rounded-full border border-line px-5 text-[14px] font-semibold text-ink-2 hover:text-ink">Back</button>
                  <button type="button" onClick={() => void finish()} disabled={busy} className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black hover:bg-gold-2 disabled:opacity-55">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enter FYKING
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</span>
      {children}
      {error && <p className="mt-1 text-[12px] text-live" role="alert">{error}</p>}
    </label>
  );
}
