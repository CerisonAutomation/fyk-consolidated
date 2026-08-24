import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import {
	getProfileById as getProfileByIdDb,
	getProfilesByIds as getProfilesByIdsDb,
} from "../supabase/index";
import { supabase } from "#/integrations/supabase/client";

// -- Schemas --

export const profileSchema = z.record(z.string(), z.unknown());
export type Profile = z.infer<typeof profileSchema>;

// -- Query keys --

export const profileKeys = {
	all: ["profiles"] as const,
	detail: (profileId: number) =>
		[...profileKeys.all, "detail", profileId] as const,
	list: (ids: number[]) => [...profileKeys.all, "list", ids] as const,
};

// -- Hooks --

/**
 * Fetch a single profile by ID.
 * Now powered by Supabase.
 */
export function useProfile(profileId: number | null | undefined) {
	return useQuery<Profile, Error>({
		queryKey: profileKeys.detail(profileId ?? 0),
		queryFn: async () => {
			const profile = await getProfileByIdDb(profileId!);
			return (profile as unknown as Profile) ?? ({} as Profile);
		},
		enabled: profileId !== null && profileId !== undefined,
		staleTime: 60_000,
	});
}

/**
 * Fetch multiple profiles by IDs (batched).
 * Now powered by Supabase.
 */
export function useProfiles(profileIds: number[]) {
	return useQuery<Profile[], Error>({
		queryKey: profileKeys.list(profileIds),
		queryFn: async () => {
			if (profileIds.length === 0) return [];
			const profiles = await getProfilesByIdsDb(profileIds);
			return profiles as unknown as Profile[];
		},
		enabled: profileIds.length > 0,
		staleTime: 60_000,
	});
}

/**
 * Patch own profile (partial update).
 * Now powered by Supabase.
 */
export function usePatchProfile() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{ cacheProfileId: number; patch: Partial<Profile> }
	>({
		mutationFn: async ({ cacheProfileId, patch }) => {
			const { error } = await supabase
				.from("Profile")
				.update(patch)
				.eq("id", cacheProfileId);
			if (error) throw new Error(error.message);
		},
		onSuccess: (_data, { cacheProfileId, patch }) => {
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
 * Now powered by Supabase.
 */
export function useUpdateProfile() {
	const queryClient = useQueryClient();

	return useMutation<
		void,
		Error,
		{
			cacheProfileId: number;
			profile: Profile;
		}
	>({
		mutationFn: async ({ cacheProfileId, profile }) => {
			const { error } = await supabase
				.from("Profile")
				.update(profile)
				.eq("id", cacheProfileId);
			if (error) throw new Error(error.message);
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
