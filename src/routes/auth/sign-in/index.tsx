import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "#/integrations/supabase/client";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";

const TEST_USERS = [
	{ email: "james@test.com", name: "James" },
	{ email: "noah@test.com", name: "Noah" },
	{ email: "reed@test.com", name: "Reed" },
	{ email: "pablo@test.com", name: "Pablo" },
	{ email: "aiden@test.com", name: "Aiden" },
] as const;

export const Route = createFileRoute("/auth/sign-in/")({
	component: SignInPage,
});

function SignInPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [magicLinkSent, setMagicLinkSent] = useState(false);
	const [sentEmail, setSentEmail] = useState("");
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
		setMagicLinkSent(false);

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

	const handleTestUserSelect = async (testEmail: string) => {
		setLoading(true);
		setError(null);
		setMagicLinkSent(false);

		try {
			const { error: otpError } = await supabase.auth.signInWithOtp({
				email: testEmail,
			});

			if (otpError) {
				setError(otpError.message);
				return;
			}

			setMagicLinkSent(true);
			setSentEmail(testEmail);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to send magic link. Please try again.",
			);
		} finally {
			setLoading(false);
		}
	};

	if (magicLinkSent) {
		return (
			<main className="flex min-h-dvh flex-col items-center justify-center px-8">
				<div className="w-full max-w-sm">
					<div className="mb-8 text-center">
						<h1 className="font-heading text-3xl font-semibold tracking-tight">
							FYK
						</h1>
						<p className="mt-1 text-muted-foreground">
							Sign in to your account
						</p>
					</div>

					<div className="rounded-lg border border-border bg-card p-6 text-center">
						<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="text-primary"
							>
								<rect width="20" height="16" x="2" y="4" rx="2" />
								<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
							</svg>
						</div>
						<h2 className="mb-2 text-lg font-semibold">Check your email</h2>
						<p className="mb-4 text-sm text-muted-foreground">
							We sent a magic link to{" "}
							<span className="font-medium text-foreground">{sentEmail}</span>.
							Click the link in the email to sign in.
						</p>
						<button
							type="button"
							onClick={() => {
								setMagicLinkSent(false);
								setSentEmail("");
							}}
							className="text-sm font-medium text-primary hover:underline"
						>
							Back to sign in
						</button>
					</div>
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
					<p className="mt-1 text-muted-foreground">Sign in to your account</p>
				</div>

				{/* Quick sign-in for test users */}
				<div className="mb-6 rounded-lg border border-dashed border-border p-4">
					<p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Quick sign-in
					</p>
					<div className="grid grid-cols-5 gap-2">
						{TEST_USERS.map((testUser) => (
							<button
								key={testUser.email}
								type="button"
								onClick={() => handleTestUserSelect(testUser.email)}
								disabled={loading}
								className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-background p-2 text-center transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
								title={testUser.email}
							>
								<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
									{testUser.name.charAt(0)}
								</div>
								<span className="text-xs leading-tight">{testUser.name}</span>
							</button>
						))}
					</div>
				</div>

				<div className="relative mb-6">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-border" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-background px-2 text-muted-foreground">
							or sign in with email
						</span>
					</div>
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
