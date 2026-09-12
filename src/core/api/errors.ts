/**
 * API error types.
 *
 * Centralised error class for HTTP responses. Re-exports from the
 * existing api-error module for convenience so consumers can import
 * from either location.
 */

export type { ApiErrorKind } from "./client/api-error";
export { ApiError, apiErrorKinds } from "./client/api-error";
