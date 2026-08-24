import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

export const viewerProfileSchema = z.record(z.unknown());
export const viewPreviewSchema = z.record(z.unknown());

const viewsListResponseSchema = z.object({
	profiles: z.array(viewerProfileSchema),
	previews: z.array(viewPreviewSchema),
});

// -- Query keys --

export const viewKeys = {
	all: ["views"] as const,
	list: () => [...viewKeys.all, "list"] as const,
};

// -- Hooks --

/**
 * Fetch views list (who viewed your profile).
 * Maps to getViews from open-grind.
 */
export function useViews() {
	return useQuery<z.infer<typeof viewsListResponseSchema>, ApiError>({
		queryKey: viewKeys.list(),
		queryFn: async () => {
			const res = await fetchRest("/v7/views/list");
			return res.jsonParsed(viewsListResponseSchema);
		},
		staleTime: 60_000,
		retry: (count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Record a profile view.
 * Maps to recordProfileView from open-grind.
 */
export function useRecordView() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{ profileId: number }
	>({
		mutationFn: async ({ profileId }) => {
			const res = await fetchRest(`/v5/views/${profileId}`, {
				method: "POST",
				body: { source: "UNKNOWN", foundVia: null },
			});
			res.assertOk();
		},
		onSuccess: () => {
			// Invalidate views list
			queryClient.invalidateQueries({ queryKey: viewKeys.all });
		},
	});
}
