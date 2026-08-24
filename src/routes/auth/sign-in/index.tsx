import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "#/integrations/supabase/client";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";

export const Route = createFileRoute("/auth/sign-in/")({
	component: SignInPage,
});

function SignInPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { user } = useSupabaseSession();
	const navigate = useNavigate();

	// Redirect if already signed in
	useEffect(() => {
		if (user) {
			navigate({ to: "/grid", replace: true });
		}
	}, [user, navigate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const { data, error: authError } =
				await supabase.auth.signInWithPassword({
					email,
					password,
				});

			if (authError) {
				setError(authError.message);
				return;
			}

			if (data.session) {
				navigate({ to: "/", replace: true });
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Sign in failed. Please try again.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="flex min-h-dvh flex-col items-center justify-center px-8">
			<div className="w-full max-w-sm">
				<div className="mb-8 text-center">
					<h1 className="font-heading text-3xl font-semibold tracking-tight">
						FYK
					</h1>
					<p className="mt-1 text-muted-foreground">Sign in to your account</p>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					{error && (
						<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					)}

					<div>
						<label htmlFor="email" className="mb-1 block text-sm font-medium">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="you@example.com"
							autoComplete="email"
							required
						/>
					</div>

					<div>
						<label
							htmlFor="password"
							className="mb-1 block text-sm font-medium"
						>
							Password
						</label>
						<input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="••••••••"
							minLength={6}
							autoComplete="current-password"
							required
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{loading ? "Signing in..." : "Sign In"}
					</button>
				</form>

				<p className="mt-6 text-center text-sm text-muted-foreground">
					Don't have an account?{" "}
					<a href="/auth/sign-up" className="text-primary hover:underline">
						Sign up
					</a>
				</p>
			</div>
		</main>
	);
}
