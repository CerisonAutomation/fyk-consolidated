import { supabase } from "#/integrations/supabase/client";

/**
 * Supabase auth client helper.
 * Re-exports the supabase client for auth operations.
 *
 * Usage:
 *   import { authClient } from '#/lib/auth-client'
 *
 *   // Sign in
 *   const { data, error } = await authClient.signIn.email({ email, password })
 *
 *   // Sign up
 *   const { data, error } = await authClient.signUp.email({ email, password })
 *
 *   // Sign out
 *   await authClient.signOut()
 *
 *   // Get session
 *   const { data: { session } } = await authClient.getSession()
 */
export const authClient = {
	signIn: {
		email: async ({ email, password }: { email: string; password: string }) => {
			const { data, error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});
			if (error) return { data: null, error };
			return { data, error: null };
		},
	},
	signUp: {
		email: async ({
			email,
			password,
			name,
		}: { email: string; password: string; name?: string }) => {
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: name ? { data: { name } } : undefined,
			});
			if (error) return { data: null, error };
			return { data, error: null };
		},
	},
	signOut: async () => {
		const { error } = await supabase.auth.signOut();
		if (error) throw error;
	},
	getSession: () => supabase.auth.getSession(),
	getUser: () => supabase.auth.getUser(),
};
