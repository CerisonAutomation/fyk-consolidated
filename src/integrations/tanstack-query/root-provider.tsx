import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let sharedQueryClient: QueryClient | null = null;

export function getContext() {
	const queryClient = new QueryClient();
	sharedQueryClient = queryClient;
	return { queryClient };
}

export function getSharedQueryClient(): QueryClient {
	if (!sharedQueryClient) {
		sharedQueryClient = new QueryClient();
	}
	return sharedQueryClient;
}

export default function TanstackQueryProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<QueryClientProvider client={getSharedQueryClient()}>
			{children}
		</QueryClientProvider>
	);
}
