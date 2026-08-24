import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

interface AuthState {
	auth: { userId: string; user: User } | null;
	setAuth: (auth: { userId: string; user: User } | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	auth: null,
	setAuth: (auth) => set({ auth }),
}));
