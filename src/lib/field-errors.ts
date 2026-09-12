import { ApiClientError } from "#/lib/client";

/**
 * Field-level error plumbing.
 *
 * The server answers a failed validation with `details.fields` — a list of
 * `{ path, message }` — because a form with six inputs cannot tell the user which
 * one to fix from a single sentence. Client-side zod produces the same shape from
 * `ZodError.issues`, so both sources land in one map and one renderer.
 */
export type FieldErrors = Record<string, string>;

/** `{ email: "Enter the email you signed up with." }` */
export function fieldErrorsFrom(error: unknown): FieldErrors {
	if (!(error instanceof ApiClientError) || !error.details) return {};
	const fields = (error.details as { fields?: unknown }).fields;
	if (!Array.isArray(fields)) return {};
	const out: FieldErrors = {};
	for (const entry of fields) {
		if (typeof entry !== "object" || entry === null) continue;
		const { path, message } = entry as { path?: unknown; message?: unknown };
		if (typeof path !== "string" || typeof message !== "string") continue;
		// The first complaint about a field is the one that explains it; later ones
		// are almost always the same constraint re-reported by a chained schema.
		if (!out[path]) out[path] = message;
	}
	return out;
}

/**
 * Anything shaped like a zod issue — `ZodIssue` and zod 4's `$ZodIssue` both fit,
 * which is why `path` is `PropertyKey[]` rather than the narrower tuple the docs
 * show. `path[0]` is the form field; deeper paths (`interests.2`) still name the
 * field that owns the input.
 */
export type FormIssue = {
	message: string;
	path: readonly PropertyKey[];
};

/** From zod's own issues, so a form validates inline before it is submitted. */
export function fieldErrorsFromIssues(
	issues: readonly FormIssue[],
): FieldErrors {
	const out: FieldErrors = {};
	for (const issue of issues) {
		const key = issue.path.map(String).join(".");
		if (!key || out[key]) continue;
		out[key] = issue.message;
	}
	return out;
}

/** Typing in a field retires its complaint; the next submit re-derives them all. */
export function clearFieldError(
	errors: FieldErrors,
	name: string,
): FieldErrors {
	if (!errors[name]) return errors;
	const next = { ...errors };
	delete next[name];
	return next;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
	return Object.keys(errors).length > 0;
}

/**
 * The ARIA pair that makes an inline error real: `aria-invalid` tells a screen
 * reader the value is bad, `aria-describedby` points at the sentence that says why.
 * Both are absent when there is no error, so a clean field is never announced as
 * an error.
 */
export function fieldErrorProps(errors: FieldErrors, name: string, id: string) {
	const message = errors[name];
	if (!message) return {};
	return {
		"aria-invalid": true as const,
		"aria-describedby": `${id}-error`,
	};
}
