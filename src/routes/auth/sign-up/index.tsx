import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "#/integrations/supabase/client";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";

export const Route = createFileRoute("/auth/sign-up/")({
	component: SignUpPage,
});

function SignUpPage() {
	const [firstName, setFirstName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const { user } = useSupabaseSession();
	const navigate = useNavigate();

	// Redirect if already signed in
	useEffect(() => {
		if (user) {
			navigate({ to: "/", replace: true });
		}
	}, [user, navigate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const { data, error: authError } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						first_name: firstName || undefined,
					},
				},
			});

			if (authError) {
				setError(authError.message);
				return;
			}

			// If email confirmation is required, show a success message
			if (data.user && !data.session) {
				setSuccess(true);
				return;
			}

			// If auto-confirmed, redirect to onboarding
			if (data.session) {
				navigate({ to: "/onboarding", replace: true });
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Sign up failed. Please try again.",
			);
		} finally {
			setLoading(false);
		}
	};

	if (success) {
		return (
			<main className="flex min-h-dvh flex-col items-center justify-center px-8">
				<div className="w-full max-w-sm text-center">
					<div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-primary/10">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="text-primary"
						>
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
							<polyline points="22 4 12 14.01 9 11.01" />
						</svg>
					</div>
					<h1 className="font-heading text-2xl font-semibold tracking-tight">
						Check your email
					</h1>
					<p className="mt-2 text-muted-foreground">
						We sent a confirmation link to <strong>{email}</strong>. Click the
						link to activate your account.
					</p>
					<a
						href="/auth/sign-in"
						className="mt-6 inline-block text-sm text-primary hover:underline"
					>
						Back to sign in
					</a>
				</div>
			</main>
		);
	}

	return (
		<main className="flex min-h-dvh flex-col items-center justify-center px-8">
			<div className="w-full max-w-sm">
				<div className="mb-8 text-center">
					<h1 className="font-heading text-3xl font-semibold tracking-tight">
						FYK
					</h1>
					<p className="mt-1 text-muted-foreground">
						Create your account
					</p>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					{error && (
						<div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					)}

					<div>
						<label
							htmlFor="firstName"
							className="mb-1 block text-sm font-medium"
						>
							First Name
						</label>
						<input
							id="firstName"
							type="text"
							value={firstName}
							onChange={(e) => setFirstName(e.target.value)}
							className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="Your first name"
							autoComplete="given-name"
						/>
					</div>

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
							required
							autoComplete="email"
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
							required
							minLength={6}
							autoComplete="new-password"
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							Must be at least 6 characters
						</p>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{loading ? "Creating account..." : "Sign Up"}
					</button>
				</form>

				<p className="mt-6 text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<a href="/auth/sign-in" className="text-primary hover:underline">
						Sign in
					</a>
				</p>
			</div>
		</main>
	);
}
