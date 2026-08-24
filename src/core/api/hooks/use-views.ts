import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
	getViews as getViewsDb,
	recordView as recordViewDb,
} from "../supabase/index";

// -- Schemas --

export const viewerProfileSchema = z.record(z.unknown());
export const viewPreviewSchema = z.record(z.unknown());

const viewsListResponseSchema = z.object({
	profiles: z.array(z.record(z.unknown())),
	previews: z.array(z.record(z.unknown())),
});

// -- Query keys --

export const viewKeys = {
	all: ["views"] as const,
	list: () => [...viewKeys.all, "list"] as const,
};

// -- Hooks --

/**
 * Fetch views list (who viewed your profile).
 * Now powered by Supabase.
 */
export function useViews() {
	return useQuery<z.infer<typeof viewsListResponseSchema>, Error>({
		queryKey: viewKeys.list(),
		queryFn: async () => {
			const result = await getViewsDb();
			return {
				profiles: result.profiles as unknown as z.infer<typeof viewerProfileSchema>[],
				previews: result.previews as unknown as z.infer<typeof viewPreviewSchema>[],
			};
		},
		staleTime: 60_000,
	});
}

/**
 * Record a profile view.
 * Now powered by Supabase.
 */
export function useRecordView() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{ profileId: number }
	>({
		mutationFn: async ({ profileId }) => {
			await recordViewDb(profileId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: viewKeys.all });
		},
	});
}
