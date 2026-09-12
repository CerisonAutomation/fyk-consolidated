import { DAY, demoMeProfileId, HOUR, MINUTE, NOW } from "../config";
import { registerPhoto } from "./avatars";

export type DemoSeed = {
	id: number;
	name: string | null;
	age: number | null;
	showAge: boolean;
	position: string | null;
	photos: number;
	bio: string | null;
	tribes: string[];
	lookingFor: string[];
	body: string | null;
	ethnicity: string | null;
	relationship: string | null;
	hiv: string | null;
	heightCm: number | null;
	weightG: number | null;
	distanceM: number | null;
	online: boolean;
	favorite: boolean;
	unread: number;
	instagram: string | null;
};

const FIRST_NAMES = [
	"James",
	"Liam",
	"Noah",
	"Oliver",
	"Elijah",
	"Lucas",
	"Mason",
	"Logan",
	"Ethan",
	"Jacob",
	"Henry",
	"Sebastian",
	"Jack",
	"Owen",
	"Theo",
	"Leo",
	"Daniel",
	"Caleb",
	"Ryan",
	"Nathan",
	"Adam",
	"Isaac",
	"Aaron",
	"Marcus",
	"Connor",
	"Eli",
	"Aiden",
	"Gabriel",
	"Julian",
	"Hunter",
	"Cameron",
	"Tyler",
	"Brandon",
	"Cole",
	"Dylan",
	"Evan",
	"Felix",
	"George",
	"Harrison",
	"Ian",
	"Jasper",
	"Kyle",
	"Levi",
	"Miles",
	"Nolan",
	"Oscar",
	"Parker",
	"Quinn",
	"Reed",
	"Simon",
	"Tobias",
	"Victor",
	"Wesley",
	"Xavier",
	"Zane",
	"Adrian",
	"Blake",
	"Chris",
	"Derek",
	"Emmett",
	"Finn",
	"Grant",
	"Hugo",
	"Ivan",
	"Jonah",
	"Kevin",
	"Max",
	"Nash",
	"Otto",
	"Pablo",
	"Rhys",
];

const NAME_EMOJIS = [
	"🐻",
	"🦊",
	"😎",
	"🔥",
	"🌊",
	"🌵",
	"🦅",
	"🐺",
	"💪",
	"🎧",
	"🍑",
	"🍆",
	"💦",
	"👀",
	"🌈",
	"⚡",
	"🥃",
	"🌙",
	"🏖️",
	"🎬",
	"🍀",
	"🦴",
];

const PROFILE_BIOS = [
	"New in town. Show me your favourite coffee spot and I will bring the conversation.",
	"Gym after work, beach on weekends, and always up for a spontaneous dinner.",
	"Product designer, terrible dancer, excellent brunch companion.",
	"Looking for dates with intention. Kindness and curiosity go a long way.",
	"Usually planning my next trip or attempting a recipe that needs fewer pans.",
	"Live music, independent films, long walks and people who can laugh at themselves.",
	"Here for good conversation first. If the chemistry is there, let us see where it goes.",
	"Dog person, morning swimmer and unapologetic dessert enthusiast.",
	"Quiet confidence over loud entrances. Say hello if you enjoy thoughtful conversation.",
	"Architecture, photography and finding the best hidden restaurants in the city.",
	"Open to friends, dates and something real. Not interested in endless texting.",
	"Sunny disposition with a dry sense of humour. Coffee this week?",
];
const EMOJI_BIOS = [
	"Coffee? ☕",
	"Beach, music, repeat 🌊",
	"Gym and good food 💪",
	"Say hello 👋",
];

function mulberry32(seed: number): () => number {
	return () => {
		seed += 0x6d2b79f5;
		let t = seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return hash;
}

function chance({
	rng,
	probability,
}: {
	rng: () => number;
	probability: number;
}): boolean {
	return rng() < probability;
}

function pick<T>({ rng, items }: { rng: () => number; items: T[] }): T {
	return items[Math.floor(rng() * items.length)];
}

function subset<T>({
	rng,
	items,
	max,
}: {
	rng: () => number;
	items: T[];
	max: number;
}): T[] {
	const count = 1 + Math.floor(rng() * max);
	const shuffled = [...items].sort(() => rng() - 0.5);
	return shuffled.slice(0, count);
}

function generatedName(rng: () => number): string | null {
	const style = rng();
	if (style < 0.06) return null;
	if (style < 0.11) {
		const count = 1 + Math.floor(rng() * 3);
		return Array.from({ length: count }, () =>
			pick({ rng, items: NAME_EMOJIS }),
		).join("");
	}
	const base = pick({ rng, items: FIRST_NAMES });
	const variant = rng();
	if (variant < 0.1) return base.toLowerCase();
	if (variant < 0.17) return base.toUpperCase();
	if (variant < 0.3) return `${base} ${pick({ rng, items: NAME_EMOJIS })}`;
	if (variant < 0.38) return `${base}${10 + Math.floor(rng() * 89)}`;
	return base;
}

function generatedBio(rng: () => number): string | null {
	const style = rng();
	if (style < 0.18) return null;
	if (style < 0.28) return "";
	if (style < 0.4) return pick({ rng, items: EMOJI_BIOS });
	return pick({ rng, items: PROFILE_BIOS });
}

function generatedPhotoCount(rng: () => number): number {
	const r = rng();
	if (r < 0.45) return 1;
	if (r < 0.72) return 2;
	if (r < 0.88) return 3;
	if (r < 0.96) return 4;
	return 5;
}

const featuredOverrides = new Map<number, Partial<DemoSeed>>([
	[
		100001,
		{
			name: "James",
			photos: 3,
			bio: "Coffee, coastal walks and conversations that do not feel like interviews.",
			distanceM: 1,
			favorite: true,
			unread: 2,
		},
	],
	[100002, { name: "🐻", age: 45, photos: 1, bio: "", distanceM: 2 }],
	[
		100003,
		{
			name: "Milo",
			age: null,
			showAge: false,
			photos: 1,
			bio: "New here. Open to a walk, a drink or a good local recommendation.",
			distanceM: 3,
			position: null,
		},
	],
	[
		100004,
		{
			name: "Noah",
			photos: 4,
			bio: "Landscape architect. Looking for someone curious, grounded and ready for a real date.",
			distanceM: 4,
		},
	],
	[
		100005,
		{
			name: "MARCUS",
			photos: 2,
			bio: "Finishing a workout, then finding somewhere good for dinner.",
			distanceM: 5,
		},
	],
	[
		100006,
		{
			name: "theo 🌊",
			photos: 1,
			bio: "👀 just here to chat",
			distanceM: 6,
			unread: 5,
		},
	],
	[
		100007,
		{
			name: "Benjamin",
			age: 39,
			showAge: false,
			photos: 2,
			bio: "Museum Sundays, live jazz and an ambitious reading list.",
			distanceM: 7,
		},
	],
	[100008, { name: "🦊", age: 19, photos: 1, bio: "👀💬🍑", distanceM: 8 }],
	[
		100009,
		{
			name: "Henry",
			age: 52,
			photos: 3,
			bio: "Chef, traveller and loyal friend. Looking for warmth, humour and consistency.",
			distanceM: 9,
			unread: 1,
		},
	],
	[
		100010,
		{
			name: "Sam",
			age: 40,
			photos: 1,
			bio: "Calm, creative and looking for genuine connection.",
			distanceM: 10,
		},
	],
	[
		100011,
		{
			name: "Lucas",
			photos: 2,
			bio: "Easygoing, active and always ready to try a new restaurant.",
			distanceM: 11,
		},
	],
	[100012, { name: "😎🔥💯", age: 29, photos: 1, bio: "", distanceM: 12 }],
	[
		100013,
		{
			name: "Alexander",
			photos: 5,
			bio: "Creative director with a weakness for old cinemas and strong espresso.",
			distanceM: 13,
			favorite: true,
		},
	],
	[
		100014,
		{
			name: "Daniel",
			position: null,
			photos: 2,
			bio: "Recently moved nearby. Friends, dates and local recommendations welcome.",
			distanceM: 14,
		},
	],
	[
		100015,
		{
			name: "Leo",
			age: 21,
			photos: 1,
			bio: "Student, cyclist and always up for gelato.",
			distanceM: 15,
		},
	],
	[
		100016,
		{
			name: "Liam",
			photos: 3,
			bio: "Runner, plant dad and weekend baker. Looking for someone genuine.",
			distanceM: 16,
		},
	],
	[100250, { favorite: false }],
	[100777, { favorite: false }],
]);

export function distanceForId(id: number): number {
	const override = featuredOverrides.get(id);
	if (
		override &&
		override.distanceM !== null &&
		override.distanceM !== undefined
	)
		return override.distanceM;
	return Math.floor(mulberry32(hashString(`dist:${id}`))() * 40000);
}

const meSeed: DemoSeed = {
	id: demoMeProfileId,
	name: "Me",
	age: 30,
	showAge: true,
	position: "Versatile",
	photos: 2,
	bio: "Ready to meet thoughtful people nearby. Edit this profile to make it yours.",
	tribes: ["Geek"],
	lookingFor: ["Chat", "Friends"],
	body: "Average",
	ethnicity: null,
	relationship: "Single",
	hiv: "NegativeOnPrep",
	heightCm: 178,
	weightG: 75_000,
	distanceM: null,
	online: true,
	favorite: false,
	unread: 0,
	instagram: "demo.user",
};

const seedCache = new Map<number, DemoSeed>();

export function profileSeed(id: number): DemoSeed {
	const cached = seedCache.get(id);
	if (cached) return cached;
	const seed = id === demoMeProfileId ? meSeed : buildSeed(id);
	seedCache.set(id, seed);
	return seed;
}

function buildSeed(id: number): DemoSeed {
	const rng = mulberry32(hashString(`profile:${id}`));
	const hasAge = chance({ rng, probability: 0.92 });
	const positions = [
		null,
		"Top",
		"Bottom",
		"Versatile",
		"VersBottom",
		"VersTop",
		"Side",
	];
	const tribes = [
		"Bear",
		"Twink",
		"Geek",
		"Daddy",
		"Jock",
		"Otter",
		"Wolf",
		"Poz",
		"Trans",
	];
	const lookingFor = ["Chat", "Friends", "Dates", "Right Now", "Networking"];
	const bodies = ["Slim", "Athletic", "Muscular", "Average", "Large", "Stocky"];
	const ethnicities = [
		"Asian",
		"Black",
		"Hispanic",
		"Middle Eastern",
		"Mixed",
		"White",
	];
	const relationships = [
		"Single",
		"Taken",
		"Married",
		"Open Relationship",
		"Divorced",
	];
	const hiv = [
		"Negative",
		"NegativeOnPrep",
		"Positive",
		"PositiveUndetectable",
	];

	const base: DemoSeed = {
		id,
		name: generatedName(rng),
		age: hasAge ? 18 + Math.floor(rng() * 47) : null,
		showAge: hasAge ? chance({ rng, probability: 0.9 }) : false,
		position: pick({ rng, items: positions }),
		photos: generatedPhotoCount(rng),
		bio: generatedBio(rng),
		tribes: subset({ rng, items: tribes, max: 3 }),
		lookingFor: subset({ rng, items: lookingFor, max: 3 }),
		body: chance({ rng, probability: 0.7 })
			? pick({ rng, items: bodies })
			: null,
		ethnicity: chance({ rng, probability: 0.6 })
			? pick({ rng, items: ethnicities })
			: null,
		relationship: chance({ rng, probability: 0.4 })
			? pick({ rng, items: relationships })
			: null,
		hiv: chance({ rng, probability: 0.45 }) ? pick({ rng, items: hiv }) : null,
		heightCm: chance({ rng, probability: 0.6 })
			? 160 + Math.floor(rng() * 40)
			: null,
		weightG: chance({ rng, probability: 0.5 })
			? (60 + Math.floor(rng() * 45)) * 1000
			: null,
		distanceM: distanceForId(id),
		online: chance({ rng, probability: 0.45 }),
		favorite: chance({ rng, probability: 0.12 }),
		unread: 0,
		instagram: chance({ rng, probability: 0.25 })
			? `${pick({ rng, items: FIRST_NAMES }).toLowerCase()}_${id % 1000}`
			: null,
	};
	base.unread =
		base.favorite && chance({ rng, probability: 0.5 })
			? 1 + Math.floor(rng() * 5)
			: 0;
	const override = featuredOverrides.get(id);
	return override ? { ...base, ...override } : base;
}

const photoCache = new Map<number, string[]>();

export function photosOf(id: number): string[] {
	const cached = photoCache.get(id);
	if (cached) return cached;
	const count = profileSeed(id).photos;
	const photos = Array.from({ length: count }, (_, i) =>
		registerPhoto(i === 0 ? String(id) : `${id}-${i}`),
	);
	photoCache.set(id, photos);
	return photos;
}

export function onlineUntilOf(seed: DemoSeed): number | null {
	return seed.online ? NOW + 12 * MINUTE : null;
}

export function lastOnlineOf(seed: DemoSeed): number {
	return seed.online ? NOW - 2 * MINUTE : NOW - ((seed.id % 47) + 1) * HOUR;
}

export function socialNetworksOf(seed: DemoSeed): Record<string, unknown> {
	return seed.instagram ? { instagram: { userId: seed.instagram } } : {};
}

export function mediasOf(seed: DemoSeed) {
	return photosOf(seed.id).map((mediaHash, i) => ({
		mediaHash,
		type: 1,
		state: 2,
		reason: null,
		takenOnGrindr: i === 0,
		createdAt: NOW - (i + 1) * DAY,
	}));
}
