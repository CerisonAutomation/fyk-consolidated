import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH } from "../context";
import { createBoardSchema } from "./board";
import {
	EDIT_WINDOW_MINUTES,
	MAX_PINS_PER_CONVERSATION,
	messageActionSchema,
	RECALL_WINDOW_MINUTES,
	reactionSchema,
	sendMessageSchema,
} from "./chat";
import { createEventSchema } from "./events";
import { decisionSchema } from "./moderation";
import {
	REPORT_REASONS,
	reportSchema,
	severityFor,
	URGENT_REASONS,
} from "./safety";
import { adultAgeOrThrow } from "./session";
import { privacySchema, profileUpdateSchema } from "./settings";

/**
 * Every rule here is a promise made in the UI ("you can edit for 15 minutes",
 * "4000 characters", "18+ only"), so the validation is tested where the promise
 * is kept rather than in a component.
 */

const UUID = "9c8a1e0a-1f2e-4a6b-9c0d-1e2f3a4b5c6d";

describe("chat windows and limits", () => {
	it("keeps edit shorter than recall, and pins capped", () => {
		expect(EDIT_WINDOW_MINUTES).toBe(15);
		expect(RECALL_WINDOW_MINUTES).toBe(60);
		expect(MAX_PINS_PER_CONVERSATION).toBe(5);
	});

	it("accepts a message up to the advertised limit and no further", () => {
		expect(sendMessageSchema.safeParse({ body: "hi" }).success).toBe(true);
		expect(
			sendMessageSchema.safeParse({ body: "x".repeat(MAX_MESSAGE_LENGTH) })
				.success,
		).toBe(true);
		expect(
			sendMessageSchema.safeParse({ body: "x".repeat(MAX_MESSAGE_LENGTH + 1) })
				.success,
		).toBe(false);
	});

	it("refuses an empty message but allows media-only", () => {
		expect(sendMessageSchema.safeParse({ body: "   " }).success).toBe(false);
		expect(
			sendMessageSchema.safeParse({
				body: "",
				mediaPath: `${UUID}/photo.jpg`,
				mediaKind: "image",
			}).success,
		).toBe(true);
		// An attachment without its kind would render as a broken bubble.
		expect(
			sendMessageSchema.safeParse({ body: "", mediaPath: "a/b.jpg" }).success,
		).toBe(false);
	});

	it("only accepts the actions the UI can perform", () => {
		expect(
			messageActionSchema.safeParse({ action: "edit", value: "corrected" })
				.success,
		).toBe(true);
		expect(messageActionSchema.safeParse({ action: "recall" }).success).toBe(
			true,
		);
		expect(messageActionSchema.safeParse({ action: "delete" }).success).toBe(
			false,
		);
		expect(
			messageActionSchema.safeParse({ action: "edit", value: "" }).success,
		).toBe(false);
	});

	it("limits reactions to the set that exists in the database", () => {
		for (const emoji of ["heart", "fire", "laugh", "wow", "like"]) {
			expect(reactionSchema.safeParse({ emoji }).success).toBe(true);
		}
		expect(reactionSchema.safeParse({ emoji: "pizza" }).success).toBe(false);
	});
});

describe("board posts", () => {
	it("requires substance and bounds the live window", () => {
		expect(
			createBoardSchema.safeParse({ body: "hi there, drinks at 8?" }).success,
		).toBe(true);
		expect(createBoardSchema.safeParse({ body: "x" }).success).toBe(false);
		expect(createBoardSchema.safeParse({ body: "y".repeat(401) }).success).toBe(
			false,
		);
		expect(
			createBoardSchema.safeParse({ body: "pool at six", windowMinutes: 5 })
				.success,
		).toBe(false);
		expect(
			createBoardSchema.safeParse({ body: "pool at six", spots: 0 }).success,
		).toBe(false);
		expect(
			createBoardSchema.safeParse({ body: "pool at six", spots: 9999 }).success,
		).toBe(false);
	});
});

describe("events", () => {
	it("refuses a start time in the past and an end before the start", () => {
		expect(
			createEventSchema.safeParse({
				title: "Rooftop drinks",
				startsAt: new Date(Date.now() - 10 * 60_000).toISOString(),
			}).success,
		).toBe(false);
		const future = new Date(Date.now() + 86_400_000).toISOString();
		expect(
			createEventSchema.safeParse({
				title: "Rooftop drinks",
				startsAt: future,
				endsAt: new Date(Date.now() + 3_600_000).toISOString(),
			}).success,
		).toBe(false);
		expect(
			createEventSchema.safeParse({ title: "Rooftop drinks", startsAt: future })
				.success,
		).toBe(true);
	});

	it("will not accept a capacity below two or an unknown content level", () => {
		const future = new Date(Date.now() + 86_400_000).toISOString();
		expect(
			createEventSchema.safeParse({
				title: "Walk",
				startsAt: future,
				capacity: 1,
			}).success,
		).toBe(false);
		expect(
			createEventSchema.safeParse({
				title: "Walk",
				startsAt: future,
				explicitness: "extreme",
			}).success,
		).toBe(false);
	});
});

describe("reports", () => {
	it("requires the reason to be one the queue understands", () => {
		for (const reason of REPORT_REASONS) {
			expect(
				reportSchema.safeParse({
					targetType: "profile",
					targetId: UUID,
					reason,
					confirmed: true,
				}).success,
			).toBe(true);
		}
		expect(
			reportSchema.safeParse({
				targetType: "profile",
				targetId: UUID,
				reason: "being_mean",
				confirmed: true,
			}).success,
		).toBe(false);
	});

	it("cannot be filed without the confirmation step", () => {
		expect(
			reportSchema.safeParse({
				targetType: "profile",
				targetId: UUID,
				reason: "spam",
				confirmed: false,
			}).success,
		).toBe(false);
		expect(
			reportSchema.safeParse({
				targetType: "profile",
				targetId: UUID,
				reason: "spam",
			}).success,
		).toBe(false);
	});

	it("keeps details inside the column's check constraint", () => {
		expect(
			reportSchema.safeParse({
				targetType: "profile",
				targetId: UUID,
				reason: "spam",
				details: "z".repeat(1001),
				confirmed: true,
			}).success,
		).toBe(false);
	});

	it("sends allegations about minors, threats and doxxing to the urgent lane", () => {
		for (const reason of URGENT_REASONS)
			expect(severityFor(reason)).toBe("urgent");
		expect(severityFor("spam")).toBe("normal");
	});
});

describe("moderation decisions", () => {
	it("needs the report id and a known action", () => {
		expect(
			decisionSchema.safeParse({ reportId: UUID, action: "warn" }).success,
		).toBe(true);
		expect(decisionSchema.safeParse({ action: "warn" }).success).toBe(false);
		expect(
			decisionSchema.safeParse({ reportId: "not-a-uuid", action: "warn" })
				.success,
		).toBe(false);
		expect(
			decisionSchema.safeParse({ reportId: UUID, action: "shoot" }).success,
		).toBe(false);
	});

	it("bounds the note to what the log column accepts", () => {
		expect(
			decisionSchema.safeParse({
				reportId: UUID,
				action: "suspend",
				note: "n".repeat(1001),
			}).success,
		).toBe(false);
	});
});

describe("profile and privacy writes", () => {
	it("only accepts the fields the settings screens own", () => {
		expect(
			profileUpdateSchema.safeParse({
				displayName: "Nik",
				bio: "x".repeat(1000),
			}).success,
		).toBe(true);
		expect(
			profileUpdateSchema.safeParse({ bio: "x".repeat(1001) }).success,
		).toBe(false);
		expect(profileUpdateSchema.safeParse({ is_suspended: false }).success).toBe(
			true,
		); // stripped, not applied
		expect(profileUpdateSchema.safeParse({ heightCm: 90 }).success).toBe(false);
		expect(profileUpdateSchema.safeParse({ handle: "NO SPACES" }).success).toBe(
			false,
		);
	});

	it("bounds the availability window so 'right now' stays true", () => {
		expect(
			privacySchema.safeParse({ openToMeet: true, availableMinutes: 120 })
				.success,
		).toBe(true);
		expect(
			privacySchema.safeParse({ openToMeet: true, availableMinutes: 60 * 24 })
				.success,
		).toBe(false);
		expect(privacySchema.safeParse({ availableMinutes: 0 }).success).toBe(
			false,
		);
	});
});

describe("adultAgeOrThrow — the 18+ gate", () => {
	it("flips on the birthday, not the day before", () => {
		expect(
			adultAgeOrThrow("2008-01-01", new Date("2026-01-01T12:00:00Z")),
		).toBe(18);
		expect(() =>
			adultAgeOrThrow("2008-01-02", new Date("2026-01-01T12:00:00Z")),
		).toThrow(/18 and over/);
	});

	it("handles a leap-day birth date", () => {
		expect(() =>
			adultAgeOrThrow("2008-02-29", new Date("2026-02-28T12:00:00Z")),
		).toThrow(/18 and over/);
		expect(
			adultAgeOrThrow("2008-02-29", new Date("2026-03-01T12:00:00Z")),
		).toBe(18);
	});

	it("refuses an unusable or impossible date instead of guessing", () => {
		expect(() => adultAgeOrThrow("not-a-date")).toThrow(/not valid/);
		// A future date gets its own message: telling someone they are under 18 when
		// they typed 2030 is a confusing dead end.
		expect(() => adultAgeOrThrow("2030-01-01")).toThrow(/in the future/);
	});

	it("does not leak the birth date into the error", () => {
		try {
			adultAgeOrThrow("2010-06-15");
		} catch (error) {
			expect((error as Error).message).not.toContain("2010");
		}
	});
});
