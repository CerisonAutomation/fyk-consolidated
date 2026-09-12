// Supabase-backed hooks. There is deliberately no HTTP client exported here:
// the transport is `#/lib/client` (which authenticates with the Supabase session
// and nothing else), and every route these hooks call is a `/api/*` handler in
// this repository. The old `/v1`–`/v7` REST surface and the `localStorage`
// bearer-token client were deleted with `0018_supabase_canonical.sql`.

export {
	accountScoped,
	clearAccountCaches,
	registerAccountCache,
} from "./account-caches";
export { ApiError, type ApiErrorKind, apiErrorKinds } from "./client/api-error";
export {
	type BlockedUser,
	blockKeys,
	useBlockedUsers,
	useBlockUser,
	useUnblockUser,
} from "./hooks/use-blocks";
export {
	favoriteKeys,
	useAddFavorite,
	useFavorites,
	useRemoveFavorite,
} from "./hooks/use-favorites";
export {
	type HiddenUser,
	hideKeys,
	useHiddenUsers,
	useHideUser,
	useUnhideUser,
} from "./hooks/use-hides";
export {
	type Profile,
	type ProfileCard,
	profileKeys,
	usePatchProfile,
	useProfile,
	useProfiles,
	useUpdateProfile,
} from "./hooks/use-profiles";
export {
	type TapType,
	tapKeys,
	useReceivedTaps,
	useSendTap,
	useTapsSent,
	useUndoTap,
} from "./hooks/use-taps";
export { useRecordView, useViews, viewKeys } from "./hooks/use-views";
