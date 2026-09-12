// Supabase-backed hooks. There is deliberately no HTTP client exported here:
// the transport is `#/lib/client` (which authenticates with the Supabase session
// and nothing else), and every route these hooks call is a `/api/*` handler in
// this repository. The old `/v1`–`/v7` REST surface and the `localStorage`
// bearer-token client were deleted with `0018_supabase_canonical.sql`.
export {
	useProfile,
	useProfiles,
	useUpdateProfile,
	usePatchProfile,
	profileKeys,
	type Profile,
	type ProfileCard,
} from "./hooks/use-profiles";
export {
	useBlockedUsers,
	useBlockUser,
	useUnblockUser,
	blockKeys,
	type BlockedUser,
} from "./hooks/use-blocks";
export {
	useHiddenUsers,
	useHideUser,
	useUnhideUser,
	hideKeys,
	type HiddenUser,
} from "./hooks/use-hides";
export {
	useFavorites,
	useAddFavorite,
	useRemoveFavorite,
	favoriteKeys,
} from "./hooks/use-favorites";
export {
	useReceivedTaps,
	useTapsSent,
	useSendTap,
	useUndoTap,
	tapKeys,
	type TapType,
} from "./hooks/use-taps";
export { useViews, useRecordView, viewKeys } from "./hooks/use-views";
export { ApiError, apiErrorKinds, type ApiErrorKind } from "./client/api-error";
export {
	accountScoped,
	registerAccountCache,
	clearAccountCaches,
} from "./account-caches";
