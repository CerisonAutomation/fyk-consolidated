export const demoBaseAvatarUrl =
	"https://api.dicebear.com/10.x/lorelei/svg?beardProbability=7&rotate=0&hairVariant=variant01:1,variant02:1,variant03:1,variant04:1,variant05:1,variant06:1,variant07:1,variant08:1,variant09:1,variant10:0.5,variant11:1,variant12:1,variant17:0.5,variant18:0.5,variant20:1,variant22:1,variant25:1,variant27:1,variant28:1,variant29:0.5,variant31:0.5,variant32:0.5,variant33:0.5,variant34:1,variant35:0.5,variant36:1,variant37:0.5,variant39:1,variant43:1,variant44:1,variant47:1&eyesVariant=variant01,variant02,variant03,variant04,variant05,variant06,variant07,variant08,variant09,variant10,variant12,variant13,variant14,variant15,variant16,variant17,variant18,variant19,variant20,variant21,variant22,variant24";

// Curated editorial portraits mirrored from FYK Zenith's production seed set.
// These are stable Unsplash assets rather than generated illustrations, which
// makes the demo discovery experience representative of a real dating product.
const demoProfilePhotos = [
	"photo-1507003211169-0a1dd7228f2d",
	"photo-1506794778202-cad84cf45f1d",
	"photo-1492562080023-ab3db95bfbce",
	"photo-1521119989659-a83eee488004",
	"photo-1539571696357-5a69c17a67c6",
	"photo-1500648767791-00dcc994a43e",
	"photo-1568602471122-7832951cc4c5",
	"photo-1581803118522-7b72a50f7e9f",
	"photo-1463453091185-61582044d556",
] as const;

const demoMediaSeeds = new Map<string, string>();

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return hash;
}

export function picsum({
	seed,
	width = 600,
	height = 800,
}: {
	seed: string;
	width?: number;
	height?: number;
}): string {
	return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

export function hashFromSeed(seed: string): string {
	let state = hashString(seed);
	let out = "";
	while (out.length < 40) {
		state = Math.imul(state ^ (state >>> 15), 2246822519) >>> 0;
		state = (state ^ (state >>> 13)) >>> 0;
		out += state.toString(16).padStart(8, "0");
	}
	return out.slice(0, 40);
}

export function registerPhoto(seed: string): string {
	const hash = hashFromSeed(seed);
	demoMediaSeeds.set(hash, seed);
	return hash;
}

export function demoMediaUrl(mediaHash: string): string;
export function demoMediaUrl(
	mediaHash: string | null | undefined,
): string | null;
export function demoMediaUrl(
	mediaHash: string | null | undefined,
): string | null {
	if (!mediaHash) return null;
	const seed = demoMediaSeeds.get(mediaHash) ?? mediaHash;
	const index = Math.abs(hashString(seed)) % demoProfilePhotos.length;
	const photo = demoProfilePhotos[index] ?? demoProfilePhotos[0];
	return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&h=1200&q=84`;
}
