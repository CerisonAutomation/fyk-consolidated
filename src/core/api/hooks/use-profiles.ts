import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { fetchRest } from "../client/api-client";
import { ApiError } from "../client/api-error";

// -- Schemas (inlined from open-grind model) --

export const profileSchema = z.record(z.unknown());
export type Profile = z.infer<typeof profileSchema>;

const profileResponseSchema = z.object({
	profiles: z.array(profileSchema).length(1),
});

const profileShortWithRightNowSchema = z.record(z.unknown());

const getProfilesResponseSchema = z.object({
	profiles: z.array(profileShortWithRightNowSchema),
});

const GET_PROFILES_MAX_IDS = 150;

// -- Query keys --

export const profileKeys = {
	all: ["profiles"] as const,
	detail: (profileId: number) => [...profileKeys.all, "detail", profileId] as const,
	list: (ids: number[]) => [...profileKeys.all, "list", ids] as const,
};

// -- Hooks --

/**
 * Fetch a single profile by ID.
 * Maps to getProfile from open-grind.
 */
export function useProfile(profileId: number | null | undefined) {
	return useQuery<Profile, ApiError>({
		queryKey: profileKeys.detail(profileId ?? 0),
		queryFn: async () => {
			const res = await fetchRest(`/v7/profiles/${profileId}`, {
				method: "GET",
			});
			const { profiles } = res.jsonParsed(profileResponseSchema);
			return profiles[0];
		},
		enabled: profileId !== null && profileId !== undefined,
		staleTime: 60_000,
		retry: (count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Fetch multiple profiles by IDs (batched).
 * Maps to getProfiles from open-grind.
 */
export function useProfiles(profileIds: number[]) {
	return useQuery<Profile[], ApiError>({
		queryKey: profileKeys.list(profileIds),
		queryFn: async () => {
			if (profileIds.length === 0) return [];
			const batches: number[][] = [];
			for (
				let start = 0;
				start < profileIds.length;
				start += GET_PROFILES_MAX_IDS
			) {
				batches.push(
					profileIds.slice(start, start + GET_PROFILES_MAX_IDS),
				);
			}
			const results = await Promise.all(
				batches.map(async (ids) => {
					const res = await fetchRest("/v3/profiles", {
						method: "POST",
						body: { targetProfileIds: ids },
					});
					return res.jsonParsed(getProfilesResponseSchema).profiles;
				}),
			);
			return results.flat();
		},
		enabled: profileIds.length > 0,
		staleTime: 60_000,
		retry: (count, error) => error instanceof ApiError && error.retryable,
	});
}

/**
 * Patch own profile (partial update).
 * Maps to patchOwnProfile from open-grind.
 */
export function usePatchProfile() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{ cacheProfileId: number; patch: Partial<Profile> }
	>({
		mutationFn: async ({ patch }) => {
			const res = await fetchRest("/v4/me/profile", {
				method: "PATCH",
				body: patch,
			});
			res.assertOk();
		},
		onSuccess: (_data, { cacheProfileId, patch }) => {
			// Optimistic update: merge patch into cached profile
			queryClient.setQueryData<Profile>(
				profileKeys.detail(cacheProfileId),
				(old) => {
					if (!old) return old;
					const merged = { ...old, ...patch };
					if (patch.socialNetworks) {
						merged.socialNetworks = {
							...(old.socialNetworks as Record<string, unknown>),
							...(patch.socialNetworks as Record<string, unknown>),
						};
					}
					return merged;
				},
			);
		},
	});
}

/**
 * Full profile update (PUT).
 * Maps to updateOwnProfile from open-grind.
 */
export function useUpdateProfile() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		ApiError,
		{
			cacheProfileId: number;
			profile: Profile;
		}
	>({
		mutationFn: async ({ profile }) => {
			const res = await fetchRest("/v3.1/me/profile", {
				method: "PUT",
				body: profile,
			});
			if (res.status !== 200) {
				res.assertOk();
			}
		},
		onSuccess: (_data, { cacheProfileId, profile }) => {
			queryClient.setQueryData<Profile>(
				profileKeys.detail(cacheProfileId),
				(old) => {
					if (!old) return old;
					return { ...old, ...profile };
				},
			);
		},
	});
}
