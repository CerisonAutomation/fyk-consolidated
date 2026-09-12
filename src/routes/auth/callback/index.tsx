import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabase } from "#/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback/")({
	component: AuthCallback,
});

/**
 * Landing page for Supabase email links (confirm, magic link, password reset).
 *
 * The browser client exchanges the `code` (PKCE) when it sees it in the URL, so
 * this page only has to confirm the session landed and then hand control back to
 * the gate. A failed exchange says so instead of bouncing to a blank screen.
 */
function AuthCallback() {
	const [state, setState] = useState<
		{ kind: "working" } | { kind: "done" } | { kind: "failed"; reason: string }
	>({ kind: "working" });

	useEffect(() => {
		let alive = true;
		const client = getSupabase();
		if (!client) {
			setState({
				kind: "failed",
				reason: "Supabase is not configured, so this link cannot be verified.",
			});
			return;
		}

		const url = new URL(window.location.href);
		const errorDescription = url.searchParams.get("error_description");
		if (errorDescription) {
			setState({
				kind: "failed",
				reason: "That link is expired or already used.",
			});
			return;
		}

		const code = url.searchParams.get("code");
		const exchange = (async () => {
			if (code) {
				const { error } = await client.auth.exchangeCodeForSession(code);
				if (error) return "exchange";
			}
			const { data } = await client.auth.getSession();
			return data.session ? "done" : "none";
		})();

		void exchange.then((result) => {
			if (!alive) return;
			if (result === "done") {
				// Strip the one-time code so a refresh or a shared link cannot replay it.
				window.history.replaceState({}, "", "/");
				setState({ kind: "done" });
				return;
			}
			if (result === "exchange") {
				setState({
					kind: "failed",
					reason: "That link is expired or already used. Request a new one.",
				});
				return;
			}
			// Some providers return a hash fragment; let onAuthStateChange settle first.
			window.setTimeout(async () => {
				const { data } = await client.auth.getSession();
				if (!alive) return;
				if (data.session) setState({ kind: "done" });
				else
					setState({
						kind: "failed",
						reason: "We could not complete sign-in from that link.",
					});
			}, 700);
		});

		return () => {
			alive = false;
		};
	}, []);

	if (state.kind === "done") return <Navigate to="/" replace />;

	return (
		<div className="grid min-h-[100svh] place-items-center bg-canvas px-6 text-center text-ink">
			<div className="flex max-w-sm flex-col items-center gap-4">
				{state.kind === "working" ? (
					<>
						<Loader2 className="h-6 w-6 animate-spin text-gold" />
						<p className="text-[14.5px] font-semibold">Verifying your link…</p>
						<p className="text-[13px] text-muted">This only takes a moment.</p>
					</>
				) : (
					<>
						<h1 className="text-[20px] font-bold">Sign-in link failed</h1>
						<p className="text-[13.5px] leading-relaxed text-muted">
							{state.reason}
						</p>
						<a
							href="/"
							className="press mt-2 flex h-11 items-center rounded-full bg-gold px-5 text-[13.5px] font-bold text-black"
						>
							Back to sign in
						</a>
					</>
				)}
			</div>
		</div>
	);
}
