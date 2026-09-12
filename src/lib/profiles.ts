import { type Person, people } from "./data";
import {
	CITY_CENTROIDS,
	compatibility,
	fuzzPin,
	type LatLng,
	pairHash,
} from "./geo";
import { normaliseRows } from "./gpu";
import {
	INTERESTS,
	KINKS,
	LIFESTYLE,
	LOOKING_FOR,
	TRIBES,
	tagOverlapScore,
} from "./taxonomy";

export type RichPerson = Person & {
	tagIds: string[];
	kinkIds: string[];
	coords: LatLng;
	lastSeenMinutes: number;
	responseRate: number;
	joinedDaysAgo: number;
	languages: string[];
};

const LABEL_MAP: Record<string, string> = {
	Athletic: "gym",
	Gym: "gym",
	Music: "music",
	Foodie: "food",
	Community: "pride",
	Travel: "travel",
	Nightlife: "techno",
	Books: "books",
	Film: "film",
	Coffee: "coffee",
	Dogs: "dogs",
	Art: "art",
	Tattoos: "tattoos",
	Cycling: "cycling",
	Outdoors: "hiking",
	Sport: "running",
	Bikes: "cycling",
	Beards: "beard",
	Bears: "bear",
	Dads: "daddy",
	Crafts: "art",
	Hosting: "hosting",
};

const LF_MAP: Record<string, string> = {
	Chat: "chat",
	Dates: "dates",
	Friends: "friends",
	Relationship: "relationship",
	"Right now": "right-now",
};

/** Deterministic pick so a profile's tags never shuffle between renders. */
function pick<T>(arr: T[], seed: string, count: number): T[] {
	const out: T[] = [];
	for (let i = 0; i < count && arr.length; i++) {
		const idx = Math.floor(pairHash(seed, `s${i}`) * arr.length);
		const item = arr[idx % arr.length]!;
		if (!out.includes(item)) out.push(item);
	}
	return out;
}

const LANGS = [
	["English", "Maltese"],
	["English", "Spanish"],
	["English", "Italian"],
	["English", "German"],
	["English", "French", "Arabic"],
	["English", "Dutch"],
];

export const richPeople: RichPerson[] = people.map((p) => {
	const base = p.tags.map((t) => LABEL_MAP[t]).filter(Boolean) as string[];
	const lf = p.lookingFor.map((t) => LF_MAP[t]).filter(Boolean) as string[];
	const extraInterests = pick(INTERESTS, `${p.id}-int`, 2).map((t) => t.id);
	const tribe = pick(TRIBES, `${p.id}-tribe`, 1).map((t) => t.id);
	const life = pick(LIFESTYLE, `${p.id}-life`, 2).map((t) => t.id);
	const kinkCount = 2 + Math.floor(pairHash(p.id, "kinks") * 4);
	const kinkIds = pick(KINKS, `${p.id}-kink`, kinkCount).map((t) => t.id);
	const lfExtra = pick(LOOKING_FOR, `${p.id}-lf`, 1).map((t) => t.id);

	const centre =
		CITY_CENTROIDS[p.city.toLowerCase()] ?? CITY_CENTROIDS.valletta!;
	const coords = fuzzPin(
		{ lat: centre.lat, lng: centre.lng },
		p.id,
		"grid",
		2600,
	);

	return {
		...p,
		tagIds: Array.from(
			new Set([
				...lf,
				...lfExtra,
				...tribe,
				...base,
				...extraInterests,
				...life,
			]),
		),
		kinkIds,
		coords,
		lastSeenMinutes: p.online
			? 0
			: Math.round(4 + pairHash(p.id, "seen") * 900),
		responseRate: 58 + Math.round(pairHash(p.id, "resp") * 40),
		joinedDaysAgo: 12 + Math.round(pairHash(p.id, "join") * 900),
		languages: LANGS[Math.floor(pairHash(p.id, "lang") * LANGS.length)] ?? [
			"English",
		],
	};
});

/**
 * Synthesised long tail so the grid, virtualisation and GPU ranking all operate at
 * a realistic scale (248 nearby, matching the header count) rather than on 20 rows.
 * Every derived profile reuses seeded imagery and deterministic attributes.
 */
const AREAS = [
	"Floriana",
	"Sliema",
	"Msida",
	"Gżira",
	"St Julian's",
	"Ta' Xbiex",
	"Pietà",
	"Marsa",
	"Birkirkara",
	"Ħamrun",
	"Qormi",
	"Mosta",
	"Naxxar",
	"Iklin",
	"Lija",
	"Paola",
	"Żabbar",
	"Mġarr",
	"Żejtun",
	"Valletta",
];
const NAMES = [
	"Andre",
	"Bruno",
	"Caleb",
	"Dean",
	"Elias",
	"Finn",
	"Gabriel",
	"Hugo",
	"Isaac",
	"Julien",
	"Karim",
	"Leo",
	"Milo",
	"Nico",
	"Oscar",
	"Pablo",
	"Quentin",
	"Rui",
	"Sacha",
	"Tomas",
	"Uriel",
	"Viktor",
	"Wes",
	"Xavi",
	"Yannick",
	"Zane",
	"Aiden",
	"Bastien",
	"Cyrus",
	"Dmitri",
	"Emre",
	"Fabio",
	"Gustav",
	"Hakan",
	"Ivan",
	"Joao",
	"Kian",
	"Lucas",
	"Marco",
	"Nadir",
];

const derived: RichPerson[] = [];
for (let i = 0; i < 228; i++) {
	const base = richPeople[i % richPeople.length]!;
	const h = pairHash(`gen-${i}`, base.id);
	const name = NAMES[i % NAMES.length]!;
	const id = `g${i}-${name.toLowerCase()}`;
	const centre =
		CITY_CENTROIDS[base.city.toLowerCase()] ?? CITY_CENTROIDS.valletta!;
	derived.push({
		...base,
		id,
		name,
		age: 19 + Math.floor(h * 42),
		km: Math.round((0.4 + h * 34) * 100) / 100,
		online: h > 0.58,
		verified: h > 0.74,
		hosting: h > 0.9,
		area: AREAS[i % AREAS.length]!,
		lastActive: h > 0.58 ? "Online now" : `${1 + Math.floor(h * 22)}h ago`,
		lastSeenMinutes: h > 0.58 ? 0 : Math.round(10 + h * 1200),
		match: 48 + Math.floor(h * 51),
		privatePhotos: h > 0.6 ? 1 + Math.floor(h * 6) : 0,
		responseRate: 44 + Math.round(h * 55),
		joinedDaysAgo: 4 + Math.round(h * 1400),
		coords: fuzzPin({ lat: centre.lat, lng: centre.lng }, id, "grid", 4200),
	});
}

richPeople.push(...derived);

export function findPerson(
	id: string | null | undefined,
): RichPerson | undefined {
	return richPeople.find((p) => p.id === id);
}

/** Bag-of-tags vector used for GPU ranking. Cheap, deterministic, no model needed. */
export const SEARCH_DIM = 96;

export function profileVector(
	p: RichPerson,
	out: Float32Array,
	offset: number,
) {
	const text =
		`${p.name} ${p.area} ${p.headline} ${p.bio} ${[...p.tagIds, ...p.kinkIds].join(" ")}`.toLowerCase();
	for (const token of text.split(/[^a-z0-9]+/)) {
		if (!token) continue;
		let h = 2166136261;
		for (let i = 0; i < token.length; i++) {
			h ^= token.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		out[offset + ((h >>> 0) % SEARCH_DIM)] += 1;
	}
}

export function queryVector(q: string): Float32Array<ArrayBuffer> {
	const v = new Float32Array(new ArrayBuffer(SEARCH_DIM * 4));
	for (const token of q.toLowerCase().split(/[^a-z0-9]+/)) {
		if (!token) continue;
		let h = 2166136261;
		for (let i = 0; i < token.length; i++) {
			h ^= token.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		v[(h >>> 0) % SEARCH_DIM] += 1;
	}
	return v;
}

let corpusCache: Float32Array<ArrayBuffer> | null = null;

export function buildCorpus(): Float32Array<ArrayBuffer> {
	if (corpusCache) return corpusCache;
	const data = new Float32Array(
		new ArrayBuffer(richPeople.length * SEARCH_DIM * 4),
	);
	richPeople.forEach((p, i) => {
		profileVector(p, data, i * SEARCH_DIM);
	});
	normaliseRows(data, richPeople.length, SEARCH_DIM);
	corpusCache = data;
	return data;
}

export function scoreFor(
	person: RichPerson,
	myTags: string[],
	radiusKm: number,
	ageRange: [number, number],
): number {
	const overlap = tagOverlapScore(myTags, [
		...person.tagIds,
		...person.kinkIds,
	]);
	const reciprocal = person.tagIds.some(
		(t) => myTags.includes(t) && t.startsWith("chat"),
	);
	return compatibility({
		tagScore: Math.max(overlap, person.match * 0.6),
		reciprocal,
		distanceKm: person.km,
		radiusKm,
		ageOk: person.age >= ageRange[0] && person.age <= ageRange[1],
	});
}

/* --------------------------- moderation seed --------------------------- */

export type ReportRow = {
	id: string;
	targetId: string;
	targetType: "USER" | "MESSAGE" | "EVENT" | "PHOTO";
	reason: string;
	details: string;
	status: "OPEN" | "IN_REVIEW" | "ACTION_TAKEN" | "DISMISSED";
	priority: "STANDARD" | "URGENT";
	createdAt: string;
};

export const seedReports: ReportRow[] = [
	{
		id: "r-1",
		targetId: "adrian",
		targetType: "USER",
		reason: "UNDERAGE_SUSPECTED",
		details:
			"Profile text mentions being in year 12. Auto-hidden pending review.",
		status: "OPEN",
		priority: "URGENT",
		createdAt: "8 min ago",
	},
	{
		id: "r-2",
		targetId: "ravi",
		targetType: "MESSAGE",
		reason: "SCAM",
		details:
			"Asked three separate members to move to another app and send a gift card.",
		status: "OPEN",
		priority: "STANDARD",
		createdAt: "1 h ago",
	},
	{
		id: "r-3",
		targetId: "jonas",
		targetType: "PHOTO",
		reason: "NONCONSENSUAL_MEDIA",
		details: "Reported by two members. Photo hidden while under review.",
		status: "IN_REVIEW",
		priority: "URGENT",
		createdAt: "3 h ago",
	},
];

export const featureFlags = [
	{
		key: "ai.smart_replies",
		label: "Smart replies",
		enabled: true,
		note: "On-device encoder ranks the reply bank.",
	},
	{
		key: "ai.translate",
		label: "Message translation",
		enabled: true,
		note: "Downloads one opus-mt pair on demand.",
	},
	{
		key: "ai.plan_extract",
		label: "Plan detection",
		enabled: true,
		note: "Local date parser plus intent confirmation.",
	},
	{
		key: "chat.calls",
		label: "Voice & video calls",
		enabled: true,
		note: "getUserMedia preview; signalling is stubbed.",
	},
	{
		key: "discover.map",
		label: "Map view",
		enabled: true,
		note: "Leaflet with OpenStreetMap tiles.",
	},
	{
		key: "voice.control",
		label: "Voice control",
		enabled: true,
		note: "Web Speech API, platform-provided.",
	},
	{
		key: "safety.interstitials",
		label: "Safety interstitials",
		enabled: true,
		note: "Shown once per thread.",
	},
	{
		key: "billing.dev_switch",
		label: "Local plan switch",
		enabled: true,
		note: "No payments are processed.",
	},
];
