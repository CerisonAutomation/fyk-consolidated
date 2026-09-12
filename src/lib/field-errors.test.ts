import { describe, expect, it } from "vitest";
import { ApiClientError } from "#/lib/client";
import {
	fieldErrorProps,
	fieldErrorsFrom,
	fieldErrorsFromIssues,
	hasFieldErrors,
} from "#/lib/field-errors";

/**
 * Validation copy is only useful if it survives the trip from the server to the
 * input it is about. These four functions are the whole path, so they are tested
 * as functions rather than hoped for inside a component.
 */

const apiError = (details: unknown) =>
	new ApiClientError({
		code: "bad_request",
		message: "Some of those answers are not valid.",
		status: 400,
		details,
	});

describe("fieldErrorsFrom", () => {
	it("reads the server's field list", () => {
		expect(
			fieldErrorsFrom(
				apiError({
					fields: [
						{ path: "handle", message: "That handle is taken." },
						{ path: "dob", message: "You must be 18 or older." },
					],
				}),
			),
		).toEqual({
			handle: "That handle is taken.",
			dob: "You must be 18 or older.",
		});
	});

	it("keeps the first complaint about a field and ignores junk", () => {
		expect(
			fieldErrorsFrom(
				apiError({
					fields: [
						{ path: "email", message: "Enter an email address." },
						{ path: "email", message: "That is not a valid email." },
						{ path: 7 },
						"nope",
						null,
					],
				}),
			),
		).toEqual({ email: "Enter an email address." });
	});

	it("is empty for anything that is not a field-carrying API error", () => {
		expect(fieldErrorsFrom(new Error("boom"))).toEqual({});
		expect(fieldErrorsFrom(apiError(undefined))).toEqual({});
		expect(fieldErrorsFrom(apiError({ fields: "handle" }))).toEqual({});
		expect(hasFieldErrors(fieldErrorsFrom(new Error("boom")))).toBe(false);
	});
});

describe("fieldErrorsFromIssues", () => {
	it("keys by dotted path, like the server does, and drops path-less issues", () => {
		// `interests.2` is kept separate rather than folded into `interests`: two
		// different complaints about one field must not overwrite each other. The
		// renderer prints the owning field's label either way. An issue with no path
		// belongs to no input, so it is not shown as if it did.
		expect(
			fieldErrorsFromIssues([
				{ message: "Pick at least one.", path: ["interests"] },
				{ message: "Too long.", path: ["interests", 2] },
				{ message: "Required.", path: [] },
			]),
		).toEqual({
			interests: "Pick at least one.",
			"interests.2": "Too long.",
		});
	});
});

describe("fieldErrorProps", () => {
	const errors = { handle: "That handle is taken." };

	it("links the input to its message only when there is one", () => {
		expect(fieldErrorProps(errors, "handle", "auth-handle")).toEqual({
			"aria-invalid": true,
			"aria-describedby": "auth-handle-error",
		});
		expect(fieldErrorProps(errors, "email", "auth-email")).toEqual({});
	});
});
