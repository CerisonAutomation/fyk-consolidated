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
import { supabase } from "#/integrations/supabase/client";

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

export function SupabaseSessionProvider({ children }: SessionProviderProps) {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		supabase.auth.getSession().then(({ data: { session: current } }) => {
			if (mounted) {
				setSession(current);
				setLoading(false);
			}
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, current) => {
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

	const signOut = useCallback(async () => {
		await supabase.auth.signOut();
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
