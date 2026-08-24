import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
	useAddFavorite,
	useRemoveFavorite,
	favoriteKeys,
} from './use-favorites';
import { useBlockUser, blockKeys } from './use-blocks';
import { useHideUser, hideKeys } from './use-hides';
import { useSendTap, tapKeys } from './use-taps';

// ---------------------------------------------------------------------------
// Toggle Favorite
// ---------------------------------------------------------------------------

export function useToggleFavorite() {
	const queryClient = useQueryClient();
	const addFavorite = useAddFavorite();
	const removeFavorite = useRemoveFavorite();

	return useMutation<
		void,
		Error,
		{ profileId: number; isFavorite: boolean },
		{ previous: unknown }
	>({
		mutationFn: async ({ profileId, isFavorite }) => {
			if (isFavorite) {
				await removeFavorite.mutateAsync({ profileId });
			} else {
				await addFavorite.mutateAsync({ profileId });
			}
		},
		onMutate: async ({ profileId, isFavorite }) => {
			await queryClient.cancelQueries({
				queryKey: ['profiles', 'detail', profileId],
			});
			const previous = queryClient.getQueryData(['profiles', 'detail', profileId]);
			queryClient.setQueryData(['profiles', 'detail', profileId], (old: Record<string, unknown> | undefined) =>
				old ? { ...old, isFavorite: !isFavorite } : old,
			);
			return { previous };
		},
		onError: (_err, vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(
					['profiles', 'detail', vars.profileId],
					context.previous,
				);
			}
		},
		onSettled: (_data, _error, vars) => {
			queryClient.invalidateQueries({ queryKey: ['profiles', 'detail', vars.profileId] });
			queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
		},
	});
}

// ---------------------------------------------------------------------------
// Block Profile
// ---------------------------------------------------------------------------

export function useBlockProfile() {
	const queryClient = useQueryClient();
	const blockUser = useBlockUser();

	return useMutation<
		void,
		Error,
		{ profileId: number },
		{ previous: unknown }
	>({
		mutationFn: async ({ profileId }) => {
			await blockUser.mutateAsync({ profileId });
		},
		onMutate: async ({ profileId }) => {
			await queryClient.cancelQueries({ queryKey: blockKeys.list() });
			const previous = queryClient.getQueryData(blockKeys.list());
			queryClient.setQueryData(
				blockKeys.list(),
				(old: Array<{ profileId: number; blockedTime: number }> | undefined) =>
					old
						? [...old, { profileId, blockedTime: Date.now() }]
						: [{ profileId, blockedTime: Date.now() }],
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(blockKeys.list(), context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: blockKeys.all });
		},
	});
}

// ---------------------------------------------------------------------------
// Hide Profile
// ---------------------------------------------------------------------------

export function useHideProfile() {
	const queryClient = useQueryClient();
	const hideUser = useHideUser();

	return useMutation<
		void,
		Error,
		{ profileId: number },
		{ previous: unknown }
	>({
		mutationFn: async ({ profileId }) => {
			await hideUser.mutateAsync({ profileId });
		},
		onMutate: async ({ profileId }) => {
			await queryClient.cancelQueries({ queryKey: hideKeys.list() });
			const previous = queryClient.getQueryData(hideKeys.list());
			queryClient.setQueryData(
				hideKeys.list(),
				(old: Array<{ profileId: number }> | undefined) =>
					old
						? [...old, { profileId }]
						: [{ profileId }],
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(hideKeys.list(), context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: hideKeys.all });
		},
	});
}

// ---------------------------------------------------------------------------
// Tap Profile
// ---------------------------------------------------------------------------

export function useTapProfile() {
	const queryClient = useQueryClient();
	const sendTap = useSendTap();

	return useMutation<
		{ isMutual: boolean },
		Error,
		{ recipientId: number; tapType: number }
	>({
		mutationFn: async ({ recipientId, tapType }) => {
			return await sendTap.mutateAsync({ recipientId, tapType });
		},
		onSuccess: (_data, { recipientId }) => {
			queryClient.invalidateQueries({ queryKey: tapKeys.all });
			queryClient.invalidateQueries({
				queryKey: ['profiles', 'detail', recipientId],
			});
		},
	});
}
