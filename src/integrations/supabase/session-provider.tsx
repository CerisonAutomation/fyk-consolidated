"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	useCallback,
	useMemo,
	type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/integrations/supabase/client";

interface SupabaseSessionContextValue {
	session: Session | null;
	user: User | null;
	loading: boolean;
	signOut: () => Promise<void>;
}

const SupabaseSessionContext = createContext<SupabaseSessionContextValue>({
	session: null,
	user: null,
	loading: true,
	signOut: async () => {},
});

export function useSupabaseSession() {
	return useContext(SupabaseSessionContext);
}

interface SessionProviderProps {
	children: ReactNode;
}

/**
 * Manages Supabase auth session state.
 *
 * Per Supabase Auth docs:
 *   - Listen to onAuthStateChange for SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED events
 *   - signOut should handle errors and clear app state
 *   - Use scope: 'global' to sign out from all sessions
 *   - getSession() may return stale data; onAuthStateChange is the source of truth
 */
export function SupabaseSessionProvider({ children }: SessionProviderProps) {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;
		const client = getSupabase();

		if (!client) {
			setLoading(false);
			return;
		}

		// Get initial session
		client.auth.getSession().then(({ data: { session: current } }) => {
			if (mounted) {
				setSession(current);
				setLoading(false);
			}
		});

		// Listen for auth state changes
		// Per docs: Events are SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY
		const {
			data: { subscription },
		} = client.auth.onAuthStateChange((_event, current) => {
			if (mounted) {
				setSession(current);
				setLoading(false);
			}
		});

		return () => {
			mounted = false;
			subscription.unsubscribe();
		};
	}, []);

	/**
	 * Sign out from all sessions and clean up app state.
	 * Per Supabase docs:
	 *   - Use scope: 'global' to sign out from all sessions
	 *   - Clear any app state before signing out
	 *   - Handle errors gracefully
	 */
	const signOut = useCallback(async () => {
		const client = getSupabase();
		if (client) {
			const { error } = await client.auth.signOut({ scope: "global" });
			if (error) {
				console.error("Sign out error:", error.message);
			}
		}
		setSession(null);
	}, []);

	const value = useMemo(
		() => ({
			session,
			user: session?.user ?? null,
			loading,
			signOut,
		}),
		[session, loading, signOut],
	);

	return (
		<SupabaseSessionContext.Provider value={value}>
			{children}
		</SupabaseSessionContext.Provider>
	);
}
