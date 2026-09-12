"use client";
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import { useAuthStore } from "#/domains/auth/store";

interface AuthGuardProps {
	children: ReactNode;
	/** Routes that are public and don't require authentication */
	publicRoutes?: string[];
}

/**
 * Wraps protected content. When no session exists, redirects to /auth/sign-in.
 * Auth routes and the landing page are always public.
 * Also syncs the Supabase session with the Zustand auth store.
 */
export function AuthGuard({ children }: AuthGuardProps) {
	const { session, loading, user } = useSupabaseSession();
	const navigate = useNavigate();
	const setAuth = useAuthStore((s) => s.setAuth);

	// Sync Supabase session → Zustand auth store
	useEffect(() => {
		if (user) {
			setAuth({ userId: user.id, user: user });
		} else if (!loading && !session) {
			setAuth(null);
		}
	}, [user, session, loading, setAuth]);

	useEffect(() => {
		if (!loading && !session) {
			navigate({ to: "/auth/sign-in", replace: true });
		}
	}, [loading, session, navigate]);

	// Show loading state while checking session
	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-4">
					<div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
					<p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-wider">
						Loading...
					</p>
				</div>
			</div>
		);
	}

	// Don't render protected content if not authenticated
	if (!session) {
		return null;
	}

	return <>{children}</>;
}
