/**
 * What a card's buttons mean, per surface — one table, ten screens.
 *
 * WHY THIS EXISTS
 * ---------------
 * The ten generated list clients (`#/components/board/board-client`, `shouts-client`,
 * `fansites-client`, `tribes-client`, `groups-client`, `events-client`,
 * `explore-client`, `meetnow-client`, `premium-client`, `gamechangers-client`) each
 * invented their own endpoints: `/api/groups/{id}/boost`, `/api/shouts/{id}/boost`,
 * `/api/board/{id}/boost`, `/api/premium/{id}/boost`, `/api/meetnow/{id}/boost`…
 * None of those paths exist, so every Boost button threw `Error("Boost failed")`,
 * and the second button on every card — Like — had no `onClick` at all. Ten screens,
 * twenty dead buttons.
 *
 * The routes that do exist are organised by *what is acted on*, and 0030 put the
 * accounting for all of them behind one module (`#/lib/promotion.server`): one price
 * table, one clamped window, one `wallet` debit, one `promotion_history` row. So the
 * client side needs one mapping rather than ten fetch calls — a domain and a row in,
 * the canonical route and its exact payload out.
 *
 * `null` is a first-class answer here. A domain with no such action returns `null`
 * and the component hides the button, because a button that posts to a path nobody
 * serves is the exact bug this file replaces. Premium and Game Changers have no
 * "engage" action; Game Changers has no "boost" either — it is a read-only catalogue
 * (`#/routes/api/gamechangers` answers 405 on POST and says where to buy), so that
 * screen's button navigates to `/paywall` instead.
 */

export type EntityDomain =
	| "board"
	| "activity"
	| "discover"
	| "fansite"
	| "group"
	| "meetnow"
	| "shout"
	| "tribe"
	| "tier"
	| "gamechanger"
	| "profile";

/** Which of a card's two buttons this request is for. */
export type EntityActionKind = "boost" | "engage";

/** The row a button was pressed on. `name` is needed by tribes, which key on name. */
export interface EntityRef {
	id: string;
	name?: string | null;
}

export interface EntityRequest {
	url: string;
	body: Record<string, unknown>;
	/** The verb the button should read, so label and payload cannot drift. */
	label: string;
}

const BOOSTS: Partial<Record<EntityDomain, (ref: EntityRef) => EntityRequest>> =
	{
		board: (ref) => ({
			url: "/api/board",
			body: { action: "boost", postId: ref.id },
			label: "Boost",
		}),
		/** Events are the `activity` entity type in `entity_promotions`. */
		activity: (ref) => ({
			url: "/api/events",
			body: { action: "boost", eventId: ref.id },
			label: "Boost",
		}),
		fansite: (ref) => ({
			url: "/api/fansites",
			body: { action: "boost", fansiteId: ref.id },
			label: "Boost",
		}),
		group: (ref) => ({
			url: `/api/groups/${encodeURIComponent(ref.id)}`,
			body: { action: "boost" },
			label: "Boost",
		}),
		shout: (ref) => ({
			url: "/api/shouts",
			body: { action: "boost", shoutId: ref.id },
			label: "Boost",
		}),
		tribe: (ref) => ({
			url: "/api/tribes",
			body: { action: "boost", tribeId: ref.id },
			label: "Boost",
		}),
		/**
		 * A tier is a purchase, not a promotion: `#/routes/api/premium` shares
		 * `#/lib/wallet.server#activateTier` with `POST /api/wallet {action:'subscribe'}`,
		 * so both buttons charge the same way and refuse with the same 503 when no
		 * payment provider is configured.
		 */
		tier: (ref) => ({
			url: "/api/premium",
			body: { action: "activate", tier: ref.id },
			label: "Activate",
		}),
		/**
		 * The profile booster is deliberately *not* an entity promotion (see the header
		 * of `#/routes/api/boost`): it debits `user_boosts`, the table the wallet UI
		 * already reads, and it boosts the caller — never the row it was pressed on.
		 */
		profile: () => ({ url: "/api/boost", body: {}, label: "Boost me" }),
		/**
		 * Meet Now posts expire in minutes, and paying to extend a spot that is about to
		 * close is not a product. What makes a spot seen is the person being visible, so
		 * this screen's button boosts the caller's profile.
		 */
		meetnow: () => ({ url: "/api/boost", body: {}, label: "Boost me" }),
	};

const ENGAGES: Partial<
	Record<EntityDomain, (ref: EntityRef) => EntityRequest>
> = {
	board: (ref) => ({
		url: "/api/board",
		body: { action: "join", postId: ref.id },
		label: "Join",
	}),
	activity: (ref) => ({
		url: "/api/events",
		body: { action: "join", eventId: ref.id },
		label: "Going",
	}),
	/** The deck's tap. `#/routes/api/discover` owns the match side effect. */
	discover: (ref) => ({
		url: "/api/discover",
		body: { targetId: ref.id, type: "like" },
		label: "Tap",
	}),
	group: (ref) => ({
		url: `/api/groups/${encodeURIComponent(ref.id)}`,
		body: { action: "join" },
		label: "Join",
	}),
	meetnow: (ref) => ({
		url: "/api/meetnow",
		body: { action: "join", postId: ref.id },
		label: "Join",
	}),
	shout: (ref) => ({
		url: "/api/shouts",
		body: { action: "like", shoutId: ref.id },
		label: "Like",
	}),
	/** Tribes key membership on the tribe *name*, not its id — see the route's union. */
	tribe: (ref) => ({
		url: "/api/tribes",
		body: { action: "join", name: ref.name ?? "" },
		label: "Join",
	}),
};

const TABLES: Record<EntityActionKind, typeof BOOSTS> = {
	boost: BOOSTS,
	engage: ENGAGES,
};

/** The canonical request for a card button, or `null` when the domain has none. */
export function entityRequest(
	domain: EntityDomain,
	kind: EntityActionKind,
	ref: EntityRef,
): EntityRequest | null {
	return TABLES[kind][domain]?.(ref) ?? null;
}

/** The label a card button should carry, or `null` when it should not render. */
export function entityLabel(
	domain: EntityDomain,
	kind: EntityActionKind,
): string | null {
	const probe = entityRequest(domain, kind, { id: "" });
	return probe ? probe.label : null;
}

/** Every domain, for the route-contract audit. */
export const ENTITY_DOMAINS: EntityDomain[] = [
	"board",
	"activity",
	"discover",
	"fansite",
	"group",
	"meetnow",
	"shout",
	"tribe",
	"tier",
	"gamechanger",
	"profile",
];
