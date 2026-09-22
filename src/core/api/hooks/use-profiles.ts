import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/client";

/**
 * Profile reads and the caller's own profile write.
 *
 * These used to be `fetchRest("/v7/profiles/{id}")` — the REST surface of the
 * project this one was merged from. Nothing here served `/v7`, and the ids it
 * expected were numeric while every id in this database is a uuid, so the
 * profile screen fetched `/v7/profiles/NaN`. They are now thin wrappers over the
 * Supabase-backed `/api` routes, which is where the authorisation actually lives
 * (Row Level Security protects the browser's own reads; a list of *other* people
 * must go through a check, so it goes through the API).
 */

export type Profile = Record<string, unknown> & { profileId: string };
export type ProfileCard = Profile & { id: string };

export const profileKeys = {
	all: ["profiles"] as const,
	detail: (profileId: string) =>
		[...profileKeys.all, "detail", profileId] as const,
	list: (profileIds: readonly string[]) =>
		[...profileKeys.all, "list", profileIds.join(",")] as const,
	me: () => [...profileKeys.all, "me"] as const,
};

/** One public profile, with the caller's flags about it (favourite, tap, note). */
export function useProfile(profileId: string | null | undefined) {
	return useQuery<Profile, Error>({
		queryKey: profileKeys.detail(profileId ?? ""),
		queryFn: () =>
			api<{ profile: Profile }>(
				`/api/profile/${encodeURIComponent(profileId ?? "")}`,
			).then((response) => response.profile),
		enabled: Boolean(profileId),
		staleTime: 30_000,
		retry: false,
	});
}

/** Several profiles at once, for the "blocked / hidden / saved" lists. */
export function useProfiles(profileIds: readonly string[]) {
	const ids = [...new Set(profileIds.filter(Boolean))].slice(0, 50);
	return useQuery<ProfileCard[], Error>({
		queryKey: profileKeys.list(ids),
		queryFn: () =>
			api<{ profiles: ProfileCard[] }>(
				`/api/profiles?ids=${ids.join(",")}`,
			).then((response) => response.profiles),
		enabled: ids.length > 0,
		staleTime: 60_000,
		retry: false,
	});
}

/** `PUT /api/profile` — the same save onboarding performs. */
export function useUpdateProfile() {
	const queryClient = useQueryClient();
	return useMutation<Profile, Error, Record<string, unknown>>({
		mutationFn: (patch) =>
			api<{ ok: boolean; profile: Profile }>("/api/profile", {
				method: "PUT",
				body: patch,
			}).then((response) => response.profile),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: profileKeys.all });
		},
	});
}

/** Alias kept for the screens that were written against the older name. */
export const usePatchProfile = useUpdateProfile;
