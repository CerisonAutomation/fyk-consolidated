/**
 * The help content behind `/faq`, kept as data rather than JSX.
 *
 * WHY IT IS NOT FETCHED
 * ---------------------
 * The screen used to `GET /api/faq` and post every card button to `/api/faq/{id}/action`.
 * Neither endpoint existed, so help was unreachable in an app that has a safety centre,
 * a billing screen and a verification flow — the three places people look for an answer
 * at the moment they are worried. Static copy is the correct storage for text that
 * changes when the product changes, and it means the answers ship with the code they
 * describe: if a route's behaviour moves, the answer that names it is in the same diff.
 *
 * Every answer names the mechanism it is describing, so it can be checked. Where an
 * endpoint or migration is the authority, that is stated in the text.
 */

export interface FaqEntry {
	id: string;
	category: FaqCategory;
	question: string;
	answer: string;
	/** Where the answer can be acted on, when the app has a screen for it. */
	to?: string;
}

export const FAQ_CATEGORIES = [
	"account",
	"safety",
	"matching",
	"money",
	"privacy",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
	account: "Account",
	safety: "Safety",
	matching: "Matching",
	money: "Money",
	privacy: "Privacy",
};

export const FAQ_ENTRIES: FaqEntry[] = [
	{
		id: "verify-pose",
		category: "account",
		question: "Why does verification ask me to copy a pose?",
		answer:
			"The pose is generated server-side on each request and expires, so the selfie has to be taken now rather than picked from your camera roll. The photo is compared with your profile photo and the level is written by the server; nothing in the app can set it. A failed check does not lock you out — you can request a new pose.",
		to: "/verify",
	},
	{
		id: "sessions",
		category: "account",
		question: "What does signing out of other devices do?",
		answer:
			"Each sign-in creates a row in the sessions table keyed by a SHA-256 hash of the token, not the token itself. Revoking a session marks it revoked, which stops requests carrying that token from being accepted; the row stays so the device list can still show that it was signed out and when.",
		to: "/settings/account-settings",
	},
	{
		id: "block",
		category: "safety",
		question: "What happens when I block someone?",
		answer:
			"Blocking stops them appearing in your discovery deck, your likes and your messages, and it is checked on the server for each of those reads — not filtered in the browser. Unblocking restores the profiles; nothing is deleted in either direction.",
		to: "/settings/blocked-users",
	},
	{
		id: "report",
		category: "safety",
		question: "Where does a report go?",
		answer:
			"Reports are written to the moderation queue with the reason, your description and the time. Filing one does not notify the other person. If you report and block in the same pass, the block is applied separately, so a failure in one does not hide the other. You can file one open report per person per reason — a repeat is folded into the existing one instead of burying the queue.",
		to: "/report-user",
	},
	{
		id: "emergency",
		category: "safety",
		question: "How do trusted contacts work?",
		answer:
			"You keep a list of contacts with a default one. Check-in records that you are safe, and an emergency share sends your last known location to that contact. Both are explicit actions you take; nothing is sent in the background.",
		to: "/safety/emergency-contact",
	},
	{
		id: "taps",
		category: "matching",
		question: "What is a tap, and why is there a limit?",
		answer:
			"A tap is the like that can lead to a match. The daily limit depends on your tier and is enforced by the server, so changing the app cannot raise it. Undoing a tap reverses the row rather than adding a counter, so the number you see is the number of taps you have, not a running total.",
		to: "/settings/subscription",
	},
	{
		id: "boost",
		category: "matching",
		question: "What does a boost actually buy?",
		answer:
			"Thirty minutes at the top of the deck, paid from your bones balance. Discovery orders on the boost's end time, so when it expires you drop back to normal ordering on the next read. Boosts are recorded per entity, which is why boosting a group and boosting your profile are separate purchases.",
		to: "/boost",
	},
	{
		id: "compatibility",
		category: "matching",
		question: "How is compatibility calculated?",
		answer:
			"It is a deterministic heuristic over the fields both profiles filled in — intents, interests, tribes, languages, position, looking-for — weighted, with the reason for each contribution returned so you can see what drove the number. It is not a model trained on other people's matches, and it does not change between two requests for the same pair.",
		to: "/interested-in-me",
	},
	{
		id: "payments",
		category: "money",
		question: "Why does the subscription screen say payments are not configured?",
		answer:
			"Tiers are granted through a wallet ledger, and no payment provider is wired up in this deployment. Rather than showing a checkout button that cannot charge anything, the screen says so and the API answers 503. When a provider is configured the same button starts a real purchase.",
		to: "/settings/subscription",
	},
	{
		id: "promo",
		category: "money",
		question: "How do promo codes work?",
		answer:
			"A code is redeemed once per account through the promo endpoint, and redemption credits the tier and its boosts through the same ledger the wallet uses. Codes are validated server-side against the canonical list; an unknown or expired code is refused with a reason rather than silently ignored.",
		to: "/paywall",
	},
	{
		id: "ledger",
		category: "money",
		question: "Where do my bones come from?",
		answer:
			"Every movement of bones is a ledger row: the daily check-in, top-ups, purchases, gifts, challenge rewards and refunds. Balances are derived from those rows, so the total you see can always be traced to entries with dates, descriptions and an idempotency key that makes a repeated credit impossible.",
		to: "/wallet",
	},
	{
		id: "data",
		category: "privacy",
		question: "How do I get a copy of my data?",
		answer:
			"The export builds a JSON bundle of your profile, messages, taps, ledger and settings, and it is generated on request so it reflects the moment you asked. It is yours to keep; the download does not expire.",
		to: "/settings/data",
	},
	{
		id: "invisible",
		category: "privacy",
		question: "Can I browse without appearing online?",
		answer:
			"Visibility, hidden mode, hide-distance, hide-online and hide-last-online are separate switches and each one is enforced where the data would otherwise be published. Hiding your online state also keeps it off public surfaces such as the shout feed, which is the part a client-side filter could not have honoured.",
		to: "/settings/privacy",
	},
	{
		id: "deletion",
		category: "privacy",
		question: "What does deleting my account remove?",
		answer:
			"Deletion runs through the deletion endpoint, which cascades through the tables that reference your account — profile, photos, taps, messages, sessions — and anonymises the reports you filed, because moderation records are kept. Anything mid-flight, such as an open report about you, is completed first.",
		to: "/settings/deactivate",
	},
];

/** Filter for the screen's search box and category chips. */
export function searchFaq(query: string, category: FaqCategory | "all"): FaqEntry[] {
	const needle = query.trim().toLowerCase();
	return FAQ_ENTRIES.filter((entry) => {
		if (category !== "all" && entry.category !== category) return false;
		if (!needle) return true;
		return (
			entry.question.toLowerCase().includes(needle) ||
			entry.answer.toLowerCase().includes(needle) ||
			entry.id.includes(needle)
		);
	});
}
