import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

export type AlbumExpirationType = "INDEFINITE" | "LIMITED";

const albumResponseSchema = z.object({
	id: z.number().optional(),
	name: z.string().optional(),
	content: z.array(
		z.object({
			mediaHash: z.string().optional(),
			remainingViews: z.number().optional(),
		}),
	),
});

export type AlbumContentResponse = z.infer<typeof albumResponseSchema>;

const myAlbumsResponseSchema = z.object({
	albums: z.array(z.record(z.string(), z.unknown())),
});

// -- Query keys --

export const albumKeys = {
	all: ["albums"] as const,
	myAlbums: () => [...albumKeys.all, "myAlbums"] as const,
	content: (albumId: number) => [...albumKeys.all, "content", albumId] as const,
	shares: (albumId: number) => [...albumKeys.all, "shares", albumId] as const,
};

// -- Hooks --

/**
 * Fetch my albums list.
 * Maps to getMyAlbums from open-grind.
 */
export function useMyAlbums() {
	return useQuery<z.infer<typeof myAlbumsResponseSchema>, ApiError>({
		queryKey: albumKeys.myAlbums(),
		queryFn: async () => {
			const res = await fetchRest("/v1/albums");
			return res.jsonParsed(myAlbumsResponseSchema);
		},
		staleTime: 60_000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Fetch album content.
 * Maps to getAlbumContent from open-grind.
 */
export function useAlbumContent(albumId: number | null | undefined) {
	return useQuery<AlbumContentResponse, ApiError>({
		queryKey: albumKeys.content(albumId ?? 0),
		queryFn: async () => {
			const res = await fetchRest(`/v2/albums/${albumId}`);
			return res.jsonParsed(albumResponseSchema);
		},
		enabled: albumId !== null && albumId !== undefined,
		staleTime: 60_000,
		retry: (_count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Share an album with profiles.
 * Maps to shareAlbum from open-grind.
 */
export function useShareAlbum() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{
			albumId: number;
			profileIds: number[];
			expirationType?: AlbumExpirationType;
		}
	>({
		mutationFn: async ({
			albumId,
			profileIds,
			expirationType = "INDEFINITE",
		}) => {
			const res = await fetchRest(`/v4/albums/${albumId}/shares`, {
				method: "POST",
				body: {
					profiles: profileIds.map((profileId) => ({
						profileId,
						expirationType,
					})),
				},
			});
			res.assertOk();
		},
		onSuccess: (_data, { albumId }) => {
			queryClient.invalidateQueries({ queryKey: albumKeys.all });
			queryClient.invalidateQueries({
				queryKey: albumKeys.shares(albumId),
			});
		},
	});
}

/**
 * Unshare an album from profiles.
 * Maps to unshareAlbum from open-grind.
 */
export function useUnshareAlbum() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{
			albumId: number;
			profileIds: number[];
		}
	>({
		mutationFn: async ({ albumId, profileIds }) => {
			const res = await fetchRest(`/v1/albums/${albumId}/unshares`, {
				method: "PUT",
				body: {
					profiles: profileIds.map((profileId) => ({
						profileId,
						shareId: crypto.randomUUID(),
					})),
				},
			});
			res.assertOk();
		},
		onSuccess: (_data, { albumId }) => {
			queryClient.invalidateQueries({ queryKey: albumKeys.all });
			queryClient.invalidateQueries({
				queryKey: albumKeys.shares(albumId),
			});
		},
	});
}
