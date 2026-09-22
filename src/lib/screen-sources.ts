/**
 * Which route each screen reads, and what its card button does.
 *
 * THE PROBLEM
 * -----------
 * Twenty-eight screens were generated from a feature list, and each one fetched a
 * path built from its own name: `/api/agenda`, `/api/circles`, `/api/vouches`,
 * `/api/who-viewed-me`, `/api/dump-rify`… None of those routes exist. The canonical
 * API is organised by domain — `/api/calendar`, `/api/tribes`, `/api/interest/{tab}`,
 * `/api/discover` — so every one of those screens rendered an empty list behind a
 * loading skeleton, and each one's card button posted to
 * `/api/<screen>/{id}/action`, which does not exist either: `Error("Action failed")`
 * on every tap, with the list invalidated afterwards so the screen looked as though
 * something had happened.
 *
 * THE FIX
 * -------
 * One table, keyed by screen, naming the route that actually holds the data, the key
 * that route answers its list under, and the write its button performs — with the
 * exact body that route's schema accepts, including the routes that read their action
 * from the query string (`#/routes/api/calls`, `#/routes/api/speed-dating`) rather
 * than the body. `action: null` is a real answer: a lightbox, a map and an analytics
 * list have nothing to press, so those screens render no button instead of one that
 * cannot work.
 *
 * `scripts/audit-contracts.mjs` reads this file: a screen mapped to a path the route
 * tree does not serve fails the audit at build time rather than at tap time.
 */

export type ScreenKey =
	| "agenda"
	| "blindDate"
	| "boost"
	| "blockedUsers"
	| "circles"
	| "discoverMap"
	| "dumpRify"
	| "emergencyContact"
	| "eventDetail"
	| "favorites"
	| "filters"
	| "groupDetail"
	| "imageViewer"
	| "interestedInMe"
	| "profileInsights"
	| "searchInbox"
	| "shoutDetail"
	| "storyDetail"
	| "subscription"
	| "videoDates"
	| "videoRoulette"
	| "welcome"
	| "whoViewedMe";

export interface ScreenAction {
	/** What the button reads. */
	label: string;
	/** Full path, including any query the route reads its action from. */
	url: (item: { id: string }) => string;
	method?: "POST" | "DELETE" | "PATCH" | "PUT";
	body?: (item: { id: string; name?: string }) => Record<string, unknown>;
}

export interface ScreenSource {
	/** What the screen is, in the words its own heading should use. */
	title: string;
	/** Canonical read. `q` carries the screen's search box and filter chip. */
	url: (q: { search: string; filter: string; id?: string }) => string;
	/** Key the route answers its list under. */
	listKey: string;
	/**
	 * The read needs an id from the URL, so the query stays disabled until the
	 * screen has one. Without this a detail screen fetched `/api/events?id=` and
	 * rendered a page of unrelated events as though one of them were the link.
	 */
	requiresId?: boolean;
	/** The card's primary button, or `null` when the row has nothing to do. */
	action: ScreenAction | null;
	/** The card's second button, where the feature genuinely has two. */
	secondary?: ScreenAction | null;
	/**
	 * A write that belongs to the screen rather than to a row: leaving a group is
	 * not something you do to one of its members, and cancelling a subscription is
	 * not something you do to one rung of the ladder. Rendered once, above the list,
	 * and handed the screen's own id.
	 */
	headerAction?: ScreenAction | null;
	/** Shown where a button would be, so an absent action is explained. */
	hint?: string;
}

const tapBack: ScreenAction = {
	label: "Tap back",
	url: () => "/api/taps",
	body: (item) => ({ targetId: item.id, type: "like", action: "tap" }),
};

export const SCREEN_SOURCES: Record<ScreenKey, ScreenSource> = {
	agenda: {
		title: "Agenda",
		url: () => "/api/calendar",
		listKey: "events",
		action: null,
		hint: "Open an event to RSVP — the calendar itself is read-only here.",
	},
	blindDate: {
		title: "Blind date",
		url: () => "/api/speed-dating",
		listKey: "events",
		// This route reads its action from the query string, not the body.
		action: {
			label: "Join round",
			url: () => "/api/speed-dating?action=join",
			body: (item) => ({ eventId: item.id }),
		},
	},
	boost: {
		title: "Boost",
		url: () => "/api/boost",
		listKey: "items",
		action: { label: "Boost me", url: () => "/api/boost", body: () => ({}) },
	},
	blockedUsers: {
		title: "Blocked users",
		url: () => "/api/social?view=blocks",
		listKey: "profiles",
		action: {
			label: "Unblock",
			url: () => "/api/social",
			body: (item) => ({ targetId: item.id, action: "unblock" }),
		},
	},
	circles: {
		title: "Circles",
		url: (q) => `/api/groups?search=${encodeURIComponent(q.search)}`,
		listKey: "items",
		action: {
			label: "Join",
			url: (item) => `/api/groups/${encodeURIComponent(item.id)}`,
			body: () => ({ action: "join" }),
		},
	},
	discoverMap: {
		title: "Map",
		url: (q) =>
			`/api/discover/places?q=${encodeURIComponent(q.search)}${
				q.filter && q.filter !== "All" ? `&type=${encodeURIComponent(q.filter)}` : ""
			}`,
		listKey: "venues",
		action: null,
		hint: "A place has nothing to press — open it on the map.",
	},
	dumpRify: {
		title: "Dump-rify",
		url: () => "/api/discover",
		listKey: "candidates",
		action: {
			label: "Keep",
			url: () => "/api/discover",
			body: (item) => ({ targetId: item.id, type: "like" }),
		},
		secondary: {
			label: "Dump",
			url: () => "/api/discover",
			body: (item) => ({ targetId: item.id, type: "pass" }),
		},
	},
	emergencyContact: {
		title: "Emergency contacts",
		url: () => "/api/safety/contacts",
		listKey: "contacts",
		action: {
			label: "Make default",
			url: () => "/api/safety/contacts",
			body: (item) => ({ action: "default", contactId: item.id }),
		},
		secondary: {
			label: "Remove",
			url: () => "/api/safety/contacts",
			body: (item) => ({ action: "remove", contactId: item.id }),
		},
	},
	eventDetail: {
		title: "Event",
		url: (q) => `/api/events?id=${encodeURIComponent(q.id ?? "")}`,
		listKey: "events",
		action: {
			label: "Going",
			url: () => "/api/events",
			body: (item) => ({ action: "join", eventId: item.id }),
		},
		requiresId: true,
		secondary: {
			label: "Not going",
			url: () => "/api/events",
			body: (item) => ({ action: "leave", eventId: item.id }),
		},
	},
	favorites: {
		title: "Favourites",
		url: () => "/api/interest/favourites",
		listKey: "profiles",
		action: {
			label: "Remove",
			url: () => "/api/interest/favourite",
			body: (item) => ({ profileId: item.id, action: "remove" }),
		},
	},
	filters: {
		title: "Saved filters",
		url: () => "/api/discover/saved-searches",
		listKey: "searches",
		// This one is a DELETE with the id in the query, and the route says so.
		action: {
			label: "Delete",
			method: "DELETE",
			url: (item) =>
				`/api/discover/saved-searches?id=${encodeURIComponent(item.id)}`,
		},
	},
	groupDetail: {
		title: "Group",
		url: (q) => `/api/groups/${encodeURIComponent(q.id ?? "")}`,
		// The rows are members, so a card button would act on a person rather than
		// on the group; leaving is the screen's own action, with the id from the URL.
		listKey: "members",
		action: null,
		headerAction: {
			label: "Leave group",
			url: (screen) => `/api/groups/${encodeURIComponent(screen.id)}`,
			body: () => ({ action: "leave" }),
		},
		requiresId: true,
		hint: "Members are listed here; leaving acts on the group, not on a member.",
	},
	imageViewer: {
		title: "Albums",
		url: () => "/api/albums",
		listKey: "albums",
		action: null,
		hint: "Open an album to view its media.",
	},
	interestedInMe: {
		title: "Interested in me",
		url: () => "/api/interest/likes",
		listKey: "profiles",
		action: tapBack,
	},
	profileInsights: {
		title: "Profile insights",
		url: () => "/api/profile/analytics",
		listKey: "views",
		action: null,
		hint: "Analytics are a record, not a to-do list.",
	},
	searchInbox: {
		title: "Search inbox",
		url: (q) =>
			`/api/search/global?type=threads&q=${encodeURIComponent(q.search)}`,
		listKey: "threads",
		action: null,
		hint: "Open a thread to read it.",
	},
	shoutDetail: {
		title: "Shout",
		url: (q) => `/api/shouts?id=${encodeURIComponent(q.id ?? "")}`,
		listKey: "items",
		action: {
			label: "Like",
			url: () => "/api/shouts",
			body: (item) => ({ action: "like", shoutId: item.id }),
		},
		requiresId: true,
		secondary: {
			label: "Boost",
			url: () => "/api/shouts",
			body: (item) => ({ action: "boost", shoutId: item.id }),
		},
	},
	storyDetail: {
		title: "Story",
		url: (q) => `/api/stories?id=${encodeURIComponent(q.id ?? "")}`,
		listKey: "stories",
		action: null,
		hint: "Stories expire; reactions belong to the viewer.",
		requiresId: true,
	},
	subscription: {
		title: "Subscription",
		url: () => "/api/premium",
		listKey: "ladder",
		action: {
			label: "Activate",
			url: () => "/api/premium",
			body: (item) => ({ action: "activate", tier: item.id }),
		},
		headerAction: {
			label: "Cancel subscription",
			url: () => "/api/premium",
			body: () => ({ action: "cancel" }),
		},
	},
	videoDates: {
		title: "Video dates",
		url: () => "/api/calls",
		listKey: "calls",
		// `create` is read from the query string; accept/decline/end from the body.
		action: {
			label: "Accept",
			url: () => "/api/calls?action=accept",
			body: (item) => ({ callId: item.id, action: "accept" }),
		},
		secondary: {
			label: "Decline",
			url: () => "/api/calls?action=decline",
			body: (item) => ({ callId: item.id, action: "decline" }),
		},
	},
	videoRoulette: {
		title: "Video roulette",
		url: () => "/api/video-roulette",
		listKey: "sessions",
		action: {
			label: "Join queue",
			url: () => "/api/video-roulette",
			body: () => ({ action: "join" }),
		},
		secondary: {
			label: "Next",
			url: () => "/api/video-roulette",
			body: (item) => ({ action: "next", sessionId: item.id }),
		},
	},
	welcome: {
		title: "Welcome",
		url: () => "/api/growth/funnel",
		listKey: "steps",
		action: {
			label: "Mark done",
			url: () => "/api/growth/funnel",
			body: (item) => ({ step: item.id }),
		},
	},
	whoViewedMe: {
		title: "Who viewed me",
		url: () => "/api/interest/visitors",
		listKey: "profiles",
		action: tapBack,
	},
};

/** Every screen key, for the audit. */
export const SCREEN_KEYS = Object.keys(SCREEN_SOURCES) as ScreenKey[];
