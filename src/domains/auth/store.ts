import { create } from 'zustand';

interface AuthState {
	auth: { userId: string } | null;
	setAuth: (auth: { userId: string } | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	auth: null,
	setAuth: (auth) => set({ auth }),
}));
