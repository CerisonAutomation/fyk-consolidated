import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { type DbLike, db } from "#/db";
import { notifications, safetyCheckins, safetyContacts, users } from "#/schema";

/**
 * Server-side half of the safety check-in (0021).
 *
 * WHY A LIB RATHER THAN TWO ROUTES
 * --------------------------------
 * Three things write a check-in: arming, confirming, and the overdue sweep. Each one
 * has to do the same two-row dance — the record in `safety_checkins` plus the
 * projection in `notifications` (which is what the inbox and the HUD actually
 * render) — and each one has to be allowed to notify *another account*, which is
 * precisely the write the browser is not granted. If that logic lived in the route
 * files it would be copied, and the copy is where the drift starts: `0019` §5 removed
 * the client's ability to insert a notification for someone else, so the route that
 * forgot to do it would fail quietly for one of three callers.
 *
 * THE OVERDUE TRANSITION IS LAZY, ON PURPOSE
 * ------------------------------------------
 * Nothing in this repository schedules work — no `pg_cron` in the migrations,
 * `UPSTASH_REDIS_REST_*` is rate limiting, and `supabase/functions/cron-cleanup` has
 * no committed schedule — so `sweepOverdue` runs on the read path: the first `GET` (or
 * `POST`) after `due_at` flips the row to `missed` and tells the contact. That is
 * deterministic and needs no infrastructure. It is *not* real-time: if the user never
 * opens the app again, nobody is paged, and the honest reading of that is that this
 * feature is a check-in, not a guard — a guard needs a scheduler and a sender (SMS or
 * email), neither of which exists here. `AUDIT.md` §3.11 keeps that open on purpose.
 *
 * Exactly-once alerting comes from the database, not from a flag in memory: the
 * `UPDATE ... WHERE status = 'armed' AND alerted_at IS null ... RETURNING` is the
 * only statement that gets to notify, so two tabs sweeping at the same moment send
 * one notice.
 */

export const MIN_MINUTES = 5;
export const MAX_MINUTES = 24 * 60;
export const DEFAULT_MINUTES = 4 * 60;

/** A check-in row as the screens consume it. */
export type CheckInPayload = {
	id: string;
	status: "armed" | "safe" | "missed" | "cancelled";
	place: string;
	armed_at: string;
	due_at: string;
	resolved_at: string | null;
	contact_id: string | null;
	contact_name: string | null;
	/** Whether the contact was actually told (null = nothing to tell yet). */
	alerted: boolean | null;
	lat: number | null;
	lng: number | null;
	note: string | null;
	/** True once `due_at` has passed and the row is still armed: the HUD's red state. */
	overdue: boolean;
};

export type SafetyContactPayload = {
	id: string;
	name: string;
	phone: string | null;
	email: string | null;
	note: string | null;
	is_default: boolean;
	/** Set when the contact also has an FYK account, i.e. when they can be notified. */
	contact_user_id: string | null;
	notifiable: boolean;
};

/**
 * A rejection the routes can answer with a status code. `status` is what the client's
 * `ApiError` surfaces, so the copy the user reads is the copy the server chose.
 */
export class SafetyError extends Error {
	readonly status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.name = "SafetyError";
		this.status = status;
	}
}

function contactPayload(
	row: typeof safetyContacts.$inferSelect,
): SafetyContactPayload {
	return {
		id: row.id,
		name: row.name,
		phone: row.phone ?? null,
		email: row.email ?? null,
		note: row.note ?? null,
		is_default: row.isDefault,
		contact_user_id: row.contactUserId ?? null,
		// An off-platform contact is shown on screen but cannot be messaged; the
		// screen has to be able to say that difference rather than promise a notice
		// nobody receives.
		notifiable: Boolean(row.contactUserId),
	};
}

export async function listContacts(
	d: DbLike = db,
	userId: string,
): Promise<SafetyContactPayload[]> {
	const rows = await d
		.select()
		.from(safetyContacts)
		.where(eq(safetyContacts.userId, userId))
		.orderBy(desc(safetyContacts.isDefault), desc(safetyContacts.createdAt))
		.limit(20);
	return rows.map(contactPayload);
}

/**
 * Add a contact. `name` is required and reachability is enforced by the migration's
 * CHECK, but the route checks it first so the message is a sentence instead of a
 * constraint name.
 */
export async function addContact(
	d: DbLike,
	userId: string,
	input: {
		name: string;
		phone?: string;
		email?: string;
		note?: string;
		contactUserId?: string;
		makeDefault?: boolean;
	},
): Promise<SafetyContactPayload> {
	const name = input.name.trim().slice(0, 80);
	if (name.length === 0) throw new SafetyError("A contact needs a name", 422);

	const phone = input.phone?.trim().slice(0, 32) || null;
	const email = input.email?.trim().slice(0, 160) || null;
	if (!phone && !email && !input.contactUserId) {
		throw new SafetyError(
			"A contact needs a phone number, an email, or their FYK account — otherwise nothing can reach them.",
			422,
		);
	}
	if (input.contactUserId === userId) {
		throw new SafetyError(
			"That is your own account. A check-in is only worth arming if somebody else can see it.",
			422,
		);
	}

	const contactUserId: string | null = input.contactUserId ?? null;
	if (contactUserId) {
		const [exists] = await d
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, contactUserId))
			.limit(1);
		if (!exists) {
			throw new SafetyError(
				"That account is not on FYK. Add the contact by phone or email instead.",
				404,
			);
		}
	}

	// The first contact becomes the default, so "notify my contact" works before a
	// picker is touched; clearing the previous default has to happen in the same
	// statement group, which is why the *route* wraps this in `db.transaction`
	// (see `DbLike`: a helper that opens its own transaction is how a partial commit
	// slips past a rollback).
	const existing = await d
		.select({ id: safetyContacts.id })
		.from(safetyContacts)
		.where(eq(safetyContacts.userId, userId))
		.limit(1);
	const makeDefault = input.makeDefault ?? existing.length === 0;
	if (makeDefault) {
		await d
			.update(safetyContacts)
			.set({ isDefault: false })
			.where(eq(safetyContacts.userId, userId));
	}

	const [row] = await d
		.insert(safetyContacts)
		.values({
			userId,
			contactUserId,
			name,
			phone,
			email,
			note: input.note?.trim().slice(0, 280) || null,
			isDefault: makeDefault,
		})
		.returning();

	return contactPayload(row);
}

/**
 * Delete a contact. Check-ins they were part of keep working: the FK is
 * `on delete set null`, and a check-in whose contact was removed is still a record of
 * something that happened.
 */
export async function removeContact(
	d: DbLike,
	userId: string,
	contactId: string,
): Promise<void> {
	const [gone] = await d
		.delete(safetyContacts)
		.where(
			and(eq(safetyContacts.id, contactId), eq(safetyContacts.userId, userId)),
		)
		.returning({ id: safetyContacts.id });
	if (!gone) throw new SafetyError("That contact is not in your list", 404);
}

/**
 * Move the default flag. Exactly one row may hold it (0021 has a partial unique
 * index for that), so clear-then-set is one transaction — opened by the route, which
 * also owns the ownership check below.
 */
export async function setDefaultContact(
	d: DbLike,
	userId: string,
	contactId: string,
): Promise<void> {
	const [contact] = await d
		.select({ id: safetyContacts.id })
		.from(safetyContacts)
		.where(
			and(eq(safetyContacts.id, contactId), eq(safetyContacts.userId, userId)),
		)
		.limit(1);
	if (!contact) throw new SafetyError("That contact is not in your list", 404);

	await d
		.update(safetyContacts)
		.set({ isDefault: false })
		.where(eq(safetyContacts.userId, userId));
	await d
		.update(safetyContacts)
		.set({ isDefault: true })
		.where(eq(safetyContacts.id, contactId));
}

function payloadFrom(
	row: typeof safetyCheckins.$inferSelect,
	contactName: string | null,
): CheckInPayload {
	return {
		id: row.id,
		status: row.status,
		place: row.place,
		armed_at: new Date(row.armedAt ?? Date.now()).toISOString(),
		due_at: new Date(row.dueAt).toISOString(),
		resolved_at: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
		contact_id: row.contactId ?? null,
		contact_name: contactName,
		alerted: row.alertedAt ? true : row.status === "armed" ? null : false,
		lat: row.lat ?? null,
		lng: row.lng ?? null,
		note: row.note ?? null,
		overdue:
			row.status === "armed" && new Date(row.dueAt).getTime() < Date.now(),
	};
}

type JoinedRow = typeof safetyCheckins.$inferSelect & {
	contact_name: string | null;
};

const selectJoined = (d: DbLike) =>
	d
		.select({
			id: safetyCheckins.id,
			userId: safetyCheckins.userId,
			contactId: safetyCheckins.contactId,
			place: safetyCheckins.place,
			lat: safetyCheckins.lat,
			lng: safetyCheckins.lng,
			armedAt: safetyCheckins.armedAt,
			dueAt: safetyCheckins.dueAt,
			resolvedAt: safetyCheckins.resolvedAt,
			status: safetyCheckins.status,
			alertedAt: safetyCheckins.alertedAt,
			alertedContact: safetyCheckins.alertedContact,
			note: safetyCheckins.note,
			notificationId: safetyCheckins.notificationId,
			contact_name: safetyContacts.name,
		})
		.from(safetyCheckins)
		.leftJoin(safetyContacts, eq(safetyCheckins.contactId, safetyContacts.id));

/**
 * Flip this user's expired armed check-ins to `missed` and tell their contact once.
 * Called from `GET` and `POST`, so a check-in cannot stay "running" in the UI simply
 * because nobody opened the app after it came due.
 *
 * The `alerted_at is null` clause inside the UPDATE's WHERE is what makes the alert
 * single-winner: two concurrent sweeps both run this statement, and only the one that
 * actually changed the row gets a `RETURNING` row and therefore gets to notify.
 */
export async function sweepOverdue(
	d: DbLike = db,
	userId: string,
): Promise<CheckInPayload[]> {
	const flipped = await d
		.update(safetyCheckins)
		.set({
			status: "missed",
			resolvedAt: new Date(),
			alertedAt: new Date(),
		})
		.where(
			and(
				eq(safetyCheckins.userId, userId),
				eq(safetyCheckins.status, "armed"),
				isNull(safetyCheckins.alertedAt),
				lt(safetyCheckins.dueAt, new Date()),
			),
		)
		.returning();

	const out: CheckInPayload[] = [];
	for (const row of flipped) {
		const contact = row.contactId
			? await d
					.select({
						name: safetyContacts.name,
						userId: safetyContacts.contactUserId,
					})
					.from(safetyContacts)
					.where(eq(safetyContacts.id, row.contactId))
					.limit(1)
			: [];
		const name = contact[0]?.name ?? null;

		// The contact is the one who must know. With no on-platform contact there is
		// nobody to tell, so the notice goes to the user and the screen says the
		// contact could not be reached — which is also true, and is the reason the
		// picker exists at all.
		const notify = contact[0]?.userId ?? userId;
		await d.insert(notifications).values({
			userId: notify,
			type: "check_in_overdue",
			title:
				notify === userId
					? "Missed safety check-in"
					: `${name ?? "Someone"} missed a safety check-in`,
			body: JSON.stringify({
				check_in_id: row.id,
				place: row.place,
				due_at: new Date(row.dueAt).toISOString(),
				contact_name: name,
			}),
			href: "/safety",
			actorId: userId,
		});

		await d
			.update(safetyCheckins)
			.set({ alertedContact: notify })
			.where(eq(safetyCheckins.id, row.id));

		out.push(payloadFrom({ ...row, contact_name: name } as JoinedRow, name));
	}
	return out;
}

/** The one check-in that is running, after any overdue transition has been applied. */
export async function getActiveCheckIn(
	d: DbLike = db,
	userId: string,
): Promise<CheckInPayload | null> {
	const rows = await selectJoined(d)
		.where(
			and(
				eq(safetyCheckins.userId, userId),
				eq(safetyCheckins.status, "armed"),
			),
		)
		.orderBy(desc(safetyCheckins.armedAt))
		.limit(1);
	const row = rows[0] as JoinedRow | undefined;
	return row ? payloadFrom(row, row.contact_name) : null;
}

export async function listCheckIns(
	d: DbLike = db,
	userId: string,
	limit = 5,
): Promise<CheckInPayload[]> {
	const rows = await selectJoined(d)
		.where(eq(safetyCheckins.userId, userId))
		.orderBy(desc(safetyCheckins.armedAt))
		.limit(limit);
	return rows.map((row) => payloadFrom(row as JoinedRow, row.contact_name));
}

/**
 * Arm a check-in. `contactId` is a row in *the caller's own* `safety_contacts`; the
 * composite foreign key in 0021 makes another account's contact unreferenceable, and
 * the lookup here is what turns that into a readable 404 instead of a constraint
 * name. With no contact at all the check-in is still armed — losing the timer is
 * worse than losing the alert — but the response says so, and the screen repeats it.
 */
export async function armCheckIn(
	d: DbLike,
	input: {
		userId: string;
		contactId?: string;
		place?: string;
		lat?: number;
		lng?: number;
		minutes?: number;
	},
): Promise<{
	checkIn: CheckInPayload;
	contactNotified: boolean;
	warning: string | null;
}> {
	const minutes = Math.min(
		MAX_MINUTES,
		Math.max(MIN_MINUTES, Math.round(input.minutes ?? DEFAULT_MINUTES)),
	);

	let contact: { id: string; name: string; userId: string | null } | null =
		null;
	if (input.contactId) {
		const found = await d
			.select({
				id: safetyContacts.id,
				name: safetyContacts.name,
				userId: safetyContacts.contactUserId,
			})
			.from(safetyContacts)
			.where(
				and(
					eq(safetyContacts.id, input.contactId),
					eq(safetyContacts.userId, input.userId),
				),
			)
			.limit(1);
		const row = found[0];
		if (!row) {
			throw new SafetyError(
				"That contact is not in your list, so it cannot be notified.",
				404,
			);
		}
		contact = row;
	} else {
		const defaults = await d
			.select({
				id: safetyContacts.id,
				name: safetyContacts.name,
				userId: safetyContacts.contactUserId,
			})
			.from(safetyContacts)
			.where(
				and(
					eq(safetyContacts.userId, input.userId),
					eq(safetyContacts.isDefault, true),
				),
			)
			.limit(1);
		contact = defaults[0] ?? null;
	}

	const [me] = await d
		.select({ displayName: users.displayName })
		.from(users)
		.where(eq(users.id, input.userId))
		.limit(1);

	const now = new Date();
	const dueAt = new Date(now.getTime() + minutes * 60_000);
	const place = (input.place ?? "").trim().slice(0, 200);
	const lat = Number.isFinite(input.lat as number)
		? (input.lat as number)
		: null;
	const lng = Number.isFinite(input.lng as number)
		? (input.lng as number)
		: null;

	// All five writes below belong to one transaction; the route opens it (see
	// `armCheckIn`'s callers) so that a check-in and its two projections can never be
	// observed half-written.
	try {
		const tx = d;
		const [row] = await tx
			.insert(safetyCheckins)
			.values({
				userId: input.userId,
				contactId: contact?.id ?? null,
				place,
				lat,
				lng,
				armedAt: now,
				dueAt,
				status: "armed",
			})
			.returning();

		const [projection] = await tx
			.insert(notifications)
			.values({
				userId: input.userId,
				type: "check_in",
				title: "Safety check-in armed",
				body: JSON.stringify({
					check_in_id: row.id,
					contact_id: contact?.id ?? null,
					place,
					due_at: dueAt.toISOString(),
					status: "armed",
				}),
				href: "/safety",
				actorId: contact?.userId ?? input.userId,
			})
			.returning({ id: notifications.id });

		await tx
			.update(safetyCheckins)
			.set({ notificationId: projection.id })
			.where(eq(safetyCheckins.id, row.id));

		let contactNotified = false;
		if (contact?.userId) {
			await tx.insert(notifications).values({
				userId: contact.userId,
				type: "check_in",
				title: `${me?.displayName ?? "Someone"} armed a safety check-in`,
				body: JSON.stringify({
					check_in_id: row.id,
					place,
					due_at: dueAt.toISOString(),
					near: lat != null && lng != null ? `${lat}, ${lng}` : null,
					status: "armed",
				}),
				href: "/safety",
				actorId: input.userId,
			});
			contactNotified = true;
		}

		return {
			checkIn: payloadFrom(
				{ ...row, contact_name: contact?.name ?? null } as JoinedRow,
				contact?.name ?? null,
			),
			contactNotified,
			warning: contactNotified
				? null
				: contact
					? `${contact.name} has no FYK account, so there is nothing to notify — the check-in is armed and their number is on your safety screen.`
					: "No emergency contact yet. Add one on this screen and the next check-in reaches a person.",
		};
	} catch (error) {
		if (error instanceof SafetyError) throw error;
		// 23505 = `safety_checkins_one_armed`, the partial unique index that keeps a
		// user from arming a second check-in on top of a running one.
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			(error as { code?: string }).code === "23505"
		) {
			throw new SafetyError(
				"A check-in is already running. Confirm safe, or wait for it to come due.",
				409,
			);
		}
		throw error;
	}
}

/**
 * Confirm safe, or report that you are not. `safe: false` is the *user* admitting a
 * missed check-in, which is a different event from the sweep (nobody was told by
 * accident) and gets its own notification so the contact's inbox says what happened.
 */
export async function resolveCheckIn(
	d: DbLike,
	input: { userId: string; checkInId: string; safe: boolean },
): Promise<{
	checkIn: CheckInPayload;
	contactNotified: boolean;
	warning: string | null;
}> {
	const found = await selectJoined(d)
		.where(
			and(
				eq(safetyCheckins.id, input.checkInId),
				eq(safetyCheckins.userId, input.userId),
			),
		)
		.limit(1);
	const row = found[0] as JoinedRow | undefined;
	if (!row) throw new SafetyError("No such check-in", 404);

	if (row.status !== "armed") {
		// Idempotent: the HUD clears its own state, and a double tap must not write a
		// second "is safe" notice to a person who already got one.
		return {
			checkIn: payloadFrom(row, row.contact_name),
			contactNotified: Boolean(row.alertedAt),
			warning: null,
		};
	}

	// `status = 'armed'` in the WHERE is the guard, not a check on a value read a
	// moment ago: if the overdue sweep flips the row between the select and here, this
	// statement matches nothing and the branch below reports what the sweep did
	// instead of overwriting it with a second notice.
	const [updated] = await d
		.update(safetyCheckins)
		.set({
			status: input.safe ? "safe" : "missed",
			resolvedAt: new Date(),
			// An unsafe resolve *is* the alert, so the sweep must not alert again.
			alertedAt: input.safe ? (row.alertedAt ?? null) : new Date(),
		})
		.where(
			and(
				eq(safetyCheckins.id, input.checkInId),
				eq(safetyCheckins.userId, input.userId),
				eq(safetyCheckins.status, "armed"),
			),
		)
		.returning();

	if (!updated) {
		const [now] = await selectJoined(d)
			.where(eq(safetyCheckins.id, input.checkInId))
			.limit(1);
		const fresh = now as JoinedRow;
		return {
			checkIn: payloadFrom(fresh, fresh.contact_name),
			contactNotified: Boolean(fresh.alertedAt),
			warning: "Your contact was already told this check-in came due.",
		};
	}

	const contact = updated.contactId
		? (
				await d
					.select({
						name: safetyContacts.name,
						userId: safetyContacts.contactUserId,
					})
					.from(safetyContacts)
					.where(eq(safetyContacts.id, updated.contactId))
					.limit(1)
			)[0]
		: undefined;

	await d.insert(notifications).values({
		userId: input.userId,
		type: input.safe ? "check_in_resolved" : "check_in_overdue",
		title: input.safe ? "Check-in confirmed safe" : "Missed check-in reported",
		body: JSON.stringify({
			check_in_id: updated.id,
			place: updated.place,
			safe: input.safe,
		}),
		href: "/safety",
		actorId: input.userId,
	});

	let contactNotified = false;
	if (contact?.userId) {
		await d.insert(notifications).values({
			userId: contact.userId,
			type: input.safe ? "check_in_resolved" : "check_in_overdue",
			title: input.safe
				? "A safety check-in was confirmed safe"
				: `${updated.place ? "Missed check-in" : "Missed safety check-in"}`,
			body: JSON.stringify({
				check_in_id: updated.id,
				place: updated.place,
				due_at: new Date(updated.dueAt).toISOString(),
				safe: input.safe,
			}),
			href: "/safety",
			actorId: input.userId,
		});
		contactNotified = true;
	}

	return {
		checkIn: payloadFrom(updated, contact?.name ?? null),
		contactNotified,
		warning: contactNotified
			? null
			: contact
				? `${contact.name} has no FYK account, so FYK could not send them a notice.`
				: "No emergency contact is set, so nobody was notified.",
	};
}
