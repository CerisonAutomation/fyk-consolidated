import { createFileRoute } from "@tanstack/react-router";
import { db } from "#/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "#/lib/api-helpers";
import {
	addContact,
	listContacts,
	removeContact,
	SafetyError,
	setDefaultContact,
} from "#/lib/safety.server";
import { json, withSecurity } from "#/middleware";

/**
 * `GET /api/safety/contacts` — the caller's emergency contacts.
 * `POST /api/safety/contacts` — `action: "add" | "remove" | "default"`.
 *
 * WHY THIS TABLE EXISTS AT ALL
 * ----------------------------
 * Before 0021 there was no emergency-contact concept in the schema. `safety-client.tsx`
 * called `createCheckIn(userId, userId, …)` — arming a check-in *against itself* — under
 * copy that reads "share your approximate location with a trusted contact", and
 * `POST /api/safety/check-in` validated `contactId` against `public.users`, which meant
 * any account, including a stranger's, could be named as someone's emergency contact by
 * whoever was arming the timer.
 *
 * `safety_contacts` is the user's own list, and the browser may write it directly under
 * RLS (own rows only) — it is data about them, not privilege, which is the same line
 * 0019 §5 drew for `user_notes`. These routes exist anyway, for two reasons: adding a
 * contact has a *consequence* (the first one becomes the default, which is what
 * `armCheckIn` falls back to when the screen sends no `contactId`), and the name has to
 * be checked against `public.users` with a readable message rather than surfacing
 * `safety_contacts_not_self` as a 500.
 */
const bodySchema = z.object({
	action: z.enum(["add", "remove", "default"]),
	contactId: z.uuid().optional(),
	name: z.string().max(80).optional(),
	phone: z.string().max(32).optional(),
	email: z.email().max(160).optional().or(z.literal("")),
	note: z.string().max(280).optional(),
	contactUserId: z.uuid().optional(),
	makeDefault: z.boolean().optional(),
});

export const Route = createFileRoute("/api/safety/contacts/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					try {
						const contacts = await listContacts(db, user.id);
						return json(
							{
								contacts,
								// The screen needs this to decide between "pick a contact" and
								// "add a contact first", without a second round trip.
								has_notifiable: contacts.some((c) => c.notifiable),
							},
							{ cache: "private" },
						);
					} catch (error) {
						return unexpected("safety/contacts/GET", error);
					}
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `contacts:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, bodySchema, 4 * 1024);

					try {
						if (body.action === "remove") {
							if (!body.contactId)
								return json({ ok: false, error: "contactId is required" });
							await db.transaction(async (tx) =>
								removeContact(tx, user.id, body.contactId as string),
							);
							return json({ ok: true, action: "remove" }, { cache: "private" });
						}

						if (body.action === "default") {
							if (!body.contactId)
								return json({ ok: false, error: "contactId is required" });
							await db.transaction(async (tx) =>
								setDefaultContact(tx, user.id, body.contactId as string),
							);
							return json(
								{ ok: true, action: "default" },
								{ cache: "private" },
							);
						}

						const contact = await db.transaction(async (tx) =>
							addContact(tx, user.id, {
								name: cleanText(body.name ?? "", 80),
								phone: cleanText(body.phone ?? "", 32),
								email: body.email ? body.email.trim().toLowerCase() : undefined,
								note: cleanText(body.note ?? "", 280),
								contactUserId: body.contactUserId,
								makeDefault: body.makeDefault,
							}),
						);
						return json({ ok: true, contact }, { cache: "private" });
					} catch (error) {
						if (error instanceof SafetyError)
							return json({
								ok: false,
								error: error.message,
								status: error.status,
							});
						return unexpected("safety/contacts/POST", error);
					}
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `contacts:POST:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
