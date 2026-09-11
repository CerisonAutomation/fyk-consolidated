import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Crown, RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { MobileNav } from "#/components/mobile-nav";
import { Sidebar } from "#/components/sidebar";
import { Topbar } from "#/components/topbar";
import { api } from "#/lib/client";
import { useAppStore } from "#/lib/store";
import type { ProfileUser } from "#/lib/types";

type MeResponse = {
	user: { id: string; email: string | null } | null;
	/**
	 * Already a `ProfileUser`: `/api/auth/me` owns the DB→UI mapping so no shell
	 * component re-derives display state (see that route for why).
	 */
	profile: ProfileUser | null;
	suspended?: boolean;
};

/**
 * Gate for the desktop/mobile shell.
 *
 * Resolves the caller through `GET /api/auth/me`, which verifies the Supabase
 * access token server-side. Three outcomes:
 *   - no user          → sign-in
 *   - user, no profile → onboarding (a signed-in auth user without a `users`
 *                        row cannot use any API route: every table FKs to it)
 *   - user + profile   → render the shell
 */
export function AuthGate({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const setUser = useAppStore((s) => s.setUser);
	const [checked, setChecked] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: ["auth", "me"],
		queryFn: () => api<MeResponse>("/api/auth/me"),
		retry: false,
		staleTime: 60_000,
	});

	useEffect(() => {
		if (isLoading) return;
		if (data?.user && data.profile) {
			setUser(data.profile);
			setChecked(true);
			return;
		}
		if (data?.user && !data.profile) {
			void navigate({ to: "/onboarding", replace: true });
			return;
		}
		void navigate({ to: "/auth/sign-in", replace: true });
	}, [isLoading, data, navigate, setUser]);

	if (checked && !isLoading && data?.user && data.profile) {
		const user = data.profile;
		return (
			<div className="flex h-[100dvh] overflow-hidden">
				<Sidebar user={user} />
				<div className="flex min-w-0 flex-1 flex-col">
					<Topbar user={user} />
					<main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 md:px-8 md:pb-8">
						{children}
					</main>
				</div>
				<MobileNav />
			</div>
		);
	}

	return (
		<div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-ink">
			<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 animate-float">
				<Crown className="h-7 w-7 text-gold" />
			</div>
			<div className="flex items-center gap-2 text-xs text-muted">
				<RefreshCw className="h-3.5 w-3.5 animate-spin" />
				Signing you in…
			</div>
		</div>
	);
}
