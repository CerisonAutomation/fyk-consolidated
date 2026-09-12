/**
 * Events: browse, detail, RSVP, host basics. Nothing more.
 *
 * Cut from the blueprint on purpose: check-in QR, weather, bill split, carpool,
 * recurring series, photo albums, post-event ratings and AI venue/time
 * suggestion. None had a working call site, and an event product with a broken
 * QR scanner is worse than one without a scanner.
 */

import { z } from "zod";
import { type RequestCtx, readJson } from "../context";
import {
	PROFILE_LIST_COLUMNS,
	type ProfileRow,
	toPublicProfile,
} from "../data/profiles";
import { asRows } from "../data/typed-rows";
import { conflict, dbFailure, forbidden, notFound } from "../errors";

const EVENT_COLUMNS =
	"id,host_id,title,description,activity_id,scale,cost,venue,address,city,lat,lng,starts_at,ends_at,capacity,explicitness,status,created_at,updated_at";

export const createEventSchema = z
	.object({
		title: z
			.string()
			.trim()
			.min(3, "Give it a real title (3+ characters).")
			.max(120),
		description: z.string().trim().max(2000).optional(),
		activityId: z.string().trim().max(40).optional(),
		startsAt: z
			.string()
			.datetime({ offset: true })
			.or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
		endsAt: z
			.string()
			.datetime({ offset: true })
			.or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/))
			.optional(),
		venue: z.string().trim().max(120).optional(),
		address: z.string().trim().max(200).optional(),
		city: z.string().trim().max(80).optional(),
		capacity: z.number().int().min(2).max(5000).optional(),
		cost: z.string().trim().max(40).optional(),
		explicitness: z.enum(["clean", "mature", "explicit"]).default("clean"),
	})
	.refine((value) => Date.parse(value.startsAt) > Date.now() - 60_000, {
		message: "Start time must not be in the past.",
		path: ["startsAt"],
	})
	.refine(
		(value) =>
			!value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt),
		{
			message: "End time must be after the start time.",
			path: ["endsAt"],
		},
	);

/** Row -> client projection. One place, so the list and the detail cannot disagree. */
function toPublicEvent(row: Record<string, unknown>) {
	return {
		id: row.id,
		title: row.title,
		description: row.description ?? null,
		startsAt: row.starts_at,
		endsAt: row.ends_at ?? null,
		venue: row.venue ?? null,
		address: row.address ?? null,
		city: row.city ?? null,
		lat: row.lat ?? null,
		lng: row.lng ?? null,
		capacity: row.capacity ?? null,
		cost: row.cost ?? null,
		explicitness: row.explicitness ?? "clean",
		status: row.status ?? "published",
		hostId: row.host_id,
		coverUrl: row.cover_url ?? null,
		activityId: row.activity_id ?? null,
	};
}

export async function listEvents(ctx: RequestCtx) {
	const caller = await ctx.callerPromise;
	const client = ctx.db();
	const when = ctx.query.get("when") ?? "upcoming";

	let builder = client
		.from("events")
		.select(EVENT_COLUMNS)
		.eq("status", "published")
		.order("starts_at", { ascending: when !== "past" });
	builder =
		when === "past"
			? builder.lt("starts_at", new Date().toISOString())
			: builder.gte("starts_at", new Date().toISOString());
	builder = builder.limit(50);

	const { data, error } = await builder;
	if (error) throw dbFailure(error, "That did not save. Please try again.");
	const rows = asRows<Record<string, unknown>>(data);
	if (!rows.length) {
		return {
			events: [],
			note:
				when === "past"
					? "No past events yet."
					: "Nothing scheduled yet. Host something and it appears here for everyone nearby.",
		};
	}

	const ids = rows.map((row) => String(row.id));
	const hostIds = [...new Set(rows.map((row) => String(row.host_id)))];
	const [rsvps, hosts] = await Promise.all([
		client
			.from("event_rsvps")
			.select("event_id,profile_id,status")
			.in("event_id", ids),
		client.from("profiles").select(PROFILE_LIST_COLUMNS).in("id", hostIds),
	]);
	const hostMap = new Map(
		asRows<ProfileRow>(hosts.data).map((row) => [row.id, row]),
	);
	const rsvpRows = asRows<{
		event_id: string;
		profile_id: string;
		status: string;
	}>(rsvps.data);

	return {
		events: rows.map((row) => {
			const attending = rsvpRows.filter(
				(rsvp) => rsvp.event_id === row.id && rsvp.status === "going",
			);
			const mine = caller
				? attending.find((rsvp) => rsvp.profile_id === caller.userId)
				: null;
			const host = hostMap.get(String(row.host_id));
			return {
				...toPublicEvent(row),
				attendeeCount: attending.length,
				attending: mine ? "going" : null,
				isHost: caller ? row.host_id === caller.userId : false,
				host: host
					? {
							id: host.id,
							displayName: host.display_name ?? host.handle,
							avatarUrl: host.avatar_url,
						}
					: null,
			};
		}),
		note: null,
	};
}

export async function getEvent(ctx: RequestCtx, eventId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(eventId);
	const client = ctx.db();

	const { data, error } = await client
		.from("events")
		.select(EVENT_COLUMNS)
		.eq("id", eventId)
		.maybeSingle();
	if (error) throw dbFailure(error, "That did not save. Please try again.");
	if (!data) throw notFound("That event does not exist or was cancelled.");
	const row = data as unknown as Record<string, unknown>;

	const rsvps = await client
		.from("event_rsvps")
		.select("profile_id,status")
		.eq("event_id", eventId);
	const rsvpRows = asRows<{ profile_id: string; status: string }>(rsvps.data);
	const goingIds = rsvpRows
		.filter((rsvp) => rsvp.status === "going")
		.map((rsvp) => rsvp.profile_id);
	const profiles = goingIds.length
		? await client
				.from("profiles")
				.select(PROFILE_LIST_COLUMNS)
				.in("id", goingIds.slice(0, 24))
		: { data: [] };

	return {
		event: toPublicEvent(row),
		attending:
			rsvpRows.find((rsvp) => rsvp.profile_id === caller.userId)?.status ??
			null,
		attendees: asRows<ProfileRow>(profiles.data).map((profile) =>
			toPublicProfile(profile, { viewer: null, client }),
		),
		attendeeCount: goingIds.length,
		isHost: row.host_id === caller.userId,
	};
}

export async function createEvent(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const parsed = await readJson(ctx.request, createEventSchema);
	const client = ctx.db();

	const insert = await client
		.from("events")
		.insert({
			host_id: caller.userId,
			title: parsed.title,
			description: parsed.description || null,
			activity_id: parsed.activityId || null,
			starts_at: new Date(parsed.startsAt).toISOString(),
			ends_at: parsed.endsAt ? new Date(parsed.endsAt).toISOString() : null,
			venue: parsed.venue || null,
			address: parsed.address || null,
			city: parsed.city || null,
			capacity: parsed.capacity ?? null,
			cost: parsed.cost || null,
			explicitness: parsed.explicitness,
			status: "published",
		})
		.select(EVENT_COLUMNS)
		.single();
	if (insert.error)
		throw dbFailure(insert.error, "That did not save. Please try again.");

	// The host is going; that is not a marketing default, it is the definition.
	await client.from("event_rsvps").insert({
		event_id: (insert.data as { id: string }).id,
		profile_id: caller.userId,
		status: "going",
	});
	return { event: insert.data };
}

export async function setRsvp(ctx: RequestCtx, eventId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(eventId);
	const body = await readJson(
		ctx.request,
		z.object({ status: z.enum(["going", "maybe", "declined"]) }),
	);
	const client = ctx.db();

	const event = await client
		.from("events")
		.select("id,capacity,status,host_id")
		.eq("id", eventId)
		.maybeSingle();
	if (!event.data) throw notFound("That event does not exist.");
	const record = event.data as unknown as {
		id: string;
		capacity: number | null;
		status: string;
	};
	if (record.status !== "published")
		throw conflict("That event is not open for RSVPs.");

	if (body.status === "going" && record.capacity) {
		const count = await client
			.from("event_rsvps")
			.select("profile_id")
			.eq("event_id", eventId)
			.eq("status", "going");
		const already = (count.data ?? []).some(
			(row: { profile_id: string }) => row.profile_id === caller.userId,
		);
		if (!already && (count.data ?? []).length >= record.capacity)
			throw conflict("That event is full. Ask the host to open another spot.");
	}

	const upsert = await client
		.from("event_rsvps")
		.upsert(
			{ event_id: eventId, profile_id: caller.userId, status: body.status },
			{ onConflict: "event_id,profile_id" },
		);
	if (upsert.error)
		throw dbFailure(upsert.error, "That did not save. Please try again.");
	return { status: body.status };
}

export async function cancelEvent(ctx: RequestCtx, eventId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(eventId);
	const client = ctx.db();
	const event = await client
		.from("events")
		.select("id,host_id")
		.eq("id", eventId)
		.maybeSingle();
	if (!event.data) throw notFound("That event does not exist.");
	if ((event.data as { host_id: string }).host_id !== caller.userId)
		throw forbidden("Only the host can cancel an event.");
	const update = await client
		.from("events")
		.update({ status: "cancelled" })
		.eq("id", eventId)
		.eq("host_id", caller.userId);
	if (update.error)
		throw dbFailure(update.error, "That did not save. Please try again.");
	return { cancelled: true };
}
