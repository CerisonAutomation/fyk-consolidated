import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "#/integrations/supabase/client";

// -- Schemas --

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
	content: (albumId: number) =>
		[...albumKeys.all, "content", albumId] as const,
	shares: (albumId: number) =>
		[...albumKeys.all, "shares", albumId] as const,
};

// -- Hooks --

/**
 * Fetch my albums list.
 * Returns photos as album content from Supabase.
 */
export function useMyAlbums() {
	return useQuery<z.infer<typeof myAlbumsResponseSchema>, Error>({
		queryKey: albumKeys.myAlbums(),
		queryFn: async () => {
			const { data: meProfile } = await supabase
				.from("Profile")
				.select("id")
				.eq("isMe", true)
				.single();
			if (!meProfile) return { albums: [] };

			const { data: photos } = await supabase
				.from("Photo")
				.select("*")
				.eq("profileId", meProfile.id);

			return {
				albums: [
					{
						id: 1,
						name: "My Photos",
						content: (photos ?? []).map((p) => ({
							mediaHash: p.hash,
							remainingViews: -1,
						})),
					},
				],
			};
		},
		staleTime: 60_000,
	});
}

/**
 * Fetch album content.
 */
export function useAlbumContent(albumId: number | null | undefined) {
	return useQuery<AlbumContentResponse, Error>({
		queryKey: albumKeys.content(albumId ?? 0),
		queryFn: async () => {
			const { data: meProfile } = await supabase
				.from("Profile")
				.select("id")
				.eq("isMe", true)
				.single();
			if (!meProfile) return { id: albumId ?? undefined, name: "", content: [] };

			const { data: photos } = await supabase
				.from("Photo")
				.select("*")
				.eq("profileId", meProfile.id);

			return {
				id: albumId ?? undefined,
				name: "My Photos",
				content: (photos ?? []).map((p: { hash: string }) => ({
					mediaHash: p.hash,
					remainingViews: -1,
				})),
			};
		},
		enabled: albumId !== null && albumId !== undefined,
		staleTime: 60_000,
	});
}

/**
 * Share an album with profiles.
 * No-op for now (no share table).
 */
export function useShareAlbum() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{
			albumId: number;
			profileIds: number[];
			expirationType?: AlbumExpirationType;
		}
	>({
		mutationFn: async () => {
			// Album sharing not implemented yet
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
 * No-op for now.
 */
export function useUnshareAlbum() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{
			albumId: number;
			profileIds: number[];
		}
	>({
		mutationFn: async () => {
			// Album sharing not implemented yet
		},
		onSuccess: (_data, { albumId }) => {
			queryClient.invalidateQueries({ queryKey: albumKeys.all });
			queryClient.invalidateQueries({
				queryKey: albumKeys.shares(albumId),
			});
		},
	});
}
