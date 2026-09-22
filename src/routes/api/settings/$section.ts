import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import { buildExport, readSection, writeSection } from "@/lib/settings.server";
import {
	findSettingsSection,
	SETTINGS_SECTION_KEYS,
} from "@/lib/settings-sections";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";

/**
 * `GET/POST /api/settings/{section}` — seventeen screens, one route, one registry.
 *
 * WHAT THIS REPLACED
 * ------------------
 * Every generated settings screen fetched `/api/settings/<its own name>` — 17 paths,
 * 34 callsites — and none of them existed, so each screen rendered a skeleton and its
 * Save button threw. `GET /api/settings` (the preferences endpoint) was the only
 * settings route, and it answers one flat bag; a screen for the app lock or the
 * discreet icon has nothing in it to read.
 *
 * ONE ROUTE, ONE REGISTRY
 * -----------------------
 * `#/lib/settings-sections` declares each section's fields and where each field's
 * truth lives; `#/lib/settings.server` reads and writes them. A new section is a
 * registry entry, not a route: the seventeen paths differ only in which fields they
 * show, and seventeen copies of a read-modify-write on `public.users` is seventeen
 * chances to write a column the schema does not have.
 *
 * WHAT A WRITE RETURNS, AND WHY IT IS NOT JUST `ok`
 * -------------------------------------------------
 * `changed`, `refused` and `unknown` are reported separately. A field this endpoint
 * does not own — a per-device switch, a deletion, a precise location fix — comes back
 * in `refused` with the route that does own it, and a payload nothing could store
 * answers `422` rather than `200 {ok:true}`. The screens that called these paths used
 * to render "Saved" over a request that had not reached a handler at all; the failure
 * mode to avoid here is the same one, one layer down.
 */

/** A section body is a bag of declared field keys; the registry validates each one. */
const payloadSchema = z
	.record(z.string(), z.unknown())
	.refine((value) => Object.keys(value).length <= 60, {
		message: "Too many keys in one request",
	});

function sectionFromPath(request: Request): string {
	const segments = new URL(request.url).pathname.split("/").filter(Boolean);
	// `/api/settings/<section>` — the section is the last segment, and `settings`
	// itself is answered by the sibling index route.
	return decodeURIComponent(segments.at(-1) ?? "");
}

function bearerToken(request: Request): string | null {
	const header = request.headers.get("authorization") ?? "";
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	return match?.[1] ?? null;
}

export const Route = createFileRoute("/api/settings/$section")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const sectionKey = sectionFromPath(request);
						if (!findSettingsSection(sectionKey))
							return jsonError(
								`Unknown settings section. Known sections: ${SETTINGS_SECTION_KEYS.join(", ")}`,
								404,
							);

						const payload = await readSection(user.id, sectionKey);
						if ("error" in payload) {
							if (payload.error === "no-profile")
								return jsonError("Finish onboarding first", 409);
							return jsonError("Unknown settings section", 404);
						}
						return json(payload, { cache: "private" });
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected(`settings/${sectionFromPath(request)}`, error);
					}
				},
				{
					auth: "required",
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `settings:section:GET:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const sectionKey = sectionFromPath(request);
						const section = findSettingsSection(sectionKey);
						if (!section)
							return jsonError(
								`Unknown settings section. Known sections: ${SETTINGS_SECTION_KEYS.join(", ")}`,
								404,
							);

						const payload = await readJson(request, payloadSchema, 16 * 1024);

						// The export section's one action produces a document rather than
						// storing a preference, and shares its column list with
						// `GET /api/settings?view=export`.
						if (sectionKey === "data-export" && payload.action === "export") {
							const exported = await buildExport(user.id);
							if (!exported.profile)
								return jsonError("No profile row yet", 409);
							return json({ ok: true, export: exported });
						}

						const outcome = await db.transaction((tx) =>
							writeSection(
								{
									userId: user.id,
									sectionKey,
									payload,
									// A password change is relayed to the provider with the
									// caller's own token; nothing is stored here.
									accessToken: bearerToken(request),
								},
								tx,
							),
						);

						if ("kind" in outcome) {
							switch (outcome.kind) {
								case "unknown-section":
									return jsonError("Unknown settings section", 404);
								case "no-profile":
									return jsonError("Finish onboarding first", 409);
								case "invalid":
									return jsonError(outcome.message, 400);
								case "auth-forward-failed":
									return jsonError(outcome.message, outcome.status);
							}
						}

						const body = {
							ok: outcome.ok,
							section: outcome.section,
							changed: outcome.changed,
							values: outcome.values,
							refused: outcome.refused,
							unknown: outcome.unknown,
						};
						// Nothing stored, and the caller sent something: say so with a
						// status a `res.ok` check can see, and name the route that can.
						if (!outcome.ok) return json(body, { status: 422 });
						return json(body);
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected(`settings/${sectionFromPath(request)}`, error);
					}
				},
				{
					auth: "required",
					maxBodySize: 16 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) =>
							`settings:section:POST:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
