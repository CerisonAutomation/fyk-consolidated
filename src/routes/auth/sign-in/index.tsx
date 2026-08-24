import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuthStore } from '#/domains/auth/store';

export const Route = createFileRoute('/auth/sign-in/')({
	component: SignInPage,
});

function SignInPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { setAuth } = useAuthStore();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			// TODO: Wire to actual auth API
			// For now, simulate sign-in
			setAuth({ userId: '123456000' });
			if (typeof window !== 'undefined') {
				window.location.href = '/grid';
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Sign in failed');
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
							required
						/>
					</div>

					<div>
						<label htmlFor="password" className="mb-1 block text-sm font-medium">
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
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{loading ? 'Signing in...' : 'Sign In'}
					</button>
				</form>

				<p className="mt-6 text-center text-sm text-muted-foreground">
					Don't have an account?{' '}
					<a href="/auth/sign-up" className="text-primary hover:underline">
						Sign up
					</a>
				</p>
			</div>
		</main>
	);
}
