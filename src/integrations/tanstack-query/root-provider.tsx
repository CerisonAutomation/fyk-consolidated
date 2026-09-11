import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Singleton QueryClient shared between the router context and the
 * React Query provider. Using `store` keeps the same instance across
 * SSR renders on the server and across client-side remounts.
 */
const queryClientStore = {
	instance: undefined as QueryClient | undefined,
	get() {
		if (!this.instance) {
			this.instance = new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						gcTime: 5 * 60_1000,
						refetchOnWindowFocus: false,
						retry: 1,
					},
				},
			});
		}
		return this.instance;
	},
};

export function getContext() {
	return {
		queryClient: queryClientStore.get(),
	};
}

export function TanstackQueryProvider({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={queryClientStore.get()}>
			{children}
		</QueryClientProvider>
	);
}
