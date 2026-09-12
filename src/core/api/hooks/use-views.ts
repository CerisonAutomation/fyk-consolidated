import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "#/lib/client";

/**
 * Profile views. `GET /api/interest/visitors` returns the identified visitors in
 * `profiles` and the incognito ones in `previews` — the screen deliberately shows
 * the second group without an id, and that distinction is the visitor's privacy
 * setting, not a client-side invention.
 */
export const viewKeys = {
	all: ["views"] as const,
	list: () => [...viewKeys.all, "list"] as const,
};

export function useViews() {
	return useQuery<{ profiles: Record<string, unknown>[]; previews: Record<string, unknown>[] }, Error>(
		{
			queryKey: viewKeys.list(),
			queryFn: () => api("/api/interest/visitors"),
			staleTime: 60_000,
			retry: false,
		},
	);
}

export function useRecordView() {
	const queryClient = useQueryClient();
	return useMutation<{ recorded: boolean }, Error, { profileId: string }>({
		mutationFn: ({ profileId }) =>
			api<{ recorded: boolean }>("/api/social", {
				method: "POST",
				body: { targetId: profileId, action: "footprint" },
			}),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: viewKeys.all }),
	});
}
