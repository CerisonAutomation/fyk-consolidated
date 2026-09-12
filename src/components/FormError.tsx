import { type FieldErrors, fieldErrorsFrom } from "#/lib/field-errors";
import { cn } from "#/lib/utils";

/**
 * The error line under a form, and the field list that comes with it.
 *
 * A one-sentence failure is fine for a two-input form and useless for a ten-question
 * one. The API answers a rejected body with `details.fields`, so this renders the
 * summary plus one line per answer that needs fixing — the alternative is a user
 * guessing which of ten inputs the sentence was about.
 */
export function FormError({
	message,
	error,
	fields: clientFields,
	inline,
	className,
}: {
	message?: string;
	/** The thrown value; its `details.fields`, if any, become the list. */
	error?: unknown;
	/** Field errors the form already knows about, e.g. from its own zod schema. */
	fields?: FieldErrors;
	/** Fields whose input shows its own note, so the list must not repeat it. */
	inline?: readonly string[];
	className?: string;
}) {
	const fields = Object.entries(clientFields ?? fieldErrorsFrom(error)).filter(
		([path]) => !inline?.includes(path.split(".")[0] ?? path),
	);
	const summary = message?.trim() ?? "";
	// A single-field failure already *is* the summary; printing it twice is noise.
	const list =
		fields.length === 1 && fields[0][1] === summary
			? []
			: fields.filter(([, text]) => text !== summary);
	if (!summary && list.length === 0) return null;

	return (
		<div
			aria-live="assertive"
			aria-atomic="true"
			className={cn(
				"rounded-xl border border-live/30 bg-live/10 px-3.5 py-2.5 text-[13px] text-live",
				className,
			)}
		>
			{summary ? <p>{summary}</p> : null}
			{list.length > 0 ? (
				<ul
					className={
						summary ? "mt-1.5 list-disc space-y-0.5 pl-4" : "space-y-0.5"
					}
				>
					{list.map(([path, text]) => (
						<li key={path}>
							<span className="font-semibold">{labelFor(path)}</span>
							{" — "}
							{text}
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

/** `interests.2` reads as nothing; a form label reads as an answer. */
function labelFor(path: string): string {
	const named: Record<string, string> = {
		displayName: "Display name",
		handle: "Handle",
		city: "City",
		dob: "Date of birth",
		email: "Email",
		password: "Password",
		interests: "Interests",
		lookingFor: "Looking for",
		latitude: "Location",
		longitude: "Location",
		bio: "Bio",
	};
	const head = path.split(".")[0] ?? path;
	return (
		named[head] ??
		head
			.replace(/[_-]/g, " ")
			.replace(/^./, (character) => character.toUpperCase())
	);
}
