import { Store } from "@tanstack/store";
import { useStore } from "@tanstack/react-store";

interface AuthState {
	auth: { userId: string } | null;
}

const authStore = new Store<AuthState>({
	auth: null,
});

export function setAuth(auth: { userId: string } | null): void {
	authStore.setState(() => ({ auth }));
}

export function getAuthSnapshot(): AuthState {
	return authStore.get();
}

export function useAuthStore(): AuthState & {
	setAuth: typeof setAuth;
} {
	const auth = useStore(authStore, (s) => s.auth);
	return { auth, setAuth };
}
