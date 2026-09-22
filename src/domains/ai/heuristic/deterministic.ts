/**
 * Deterministic pseudo-randomness for the heuristic engine.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * Five heuristics reached for `Math.random()`. Two of them were answering questions
 * people act on:
 *
 *   - `scorePhoto()` returned a "lighting" and "blur" score drawn from `Math.random()`
 *     unless the URL happened to contain the substring `dark` or `blur`. The same
 *     photo scored 78 on one request and 41 on the next, and the photo editor printed
 *     both as measurements of that photo.
 *   - `heuristicDeepfakeScore()` returned `Math.random() * 0.3` as its baseline, so a
 *     catfish check could answer 0.02 or 0.29 for the same image depending on when it
 *     ran — and 0.29 is close enough to a threshold to matter.
 *
 * A number that changes between two identical requests is not a measurement, and a
 * screen that prints it is telling the person something false about their own photo.
 * These helpers derive the value from a seed — the URL, the text, the id — so the same
 * input always produces the same output: still a heuristic, but a repeatable one that
 * can be tested, cached and explained.
 *
 * Picking a *template* at random (`#/domains/ai/heuristic/auto-reply`, `autocomplete`,
 * `escalation-coach`) is a different thing and is left alone: variety there is the
 * product, and no claim about the world rests on which line was chosen.
 */

/**
 * A stable 32-bit hash of a string. Same input, same output, forever.
 *
 * The accumulate loop alone is not enough, and the version this replaced proved it:
 * `"spread-0"` and `"spread-1"` hash to values one apart, and a Lehmer generator
 * started from two seeds that differ by one produces two outputs that differ by
 * `16807 / 2^31` — about 8 millionths. Scaled onto a 0–100 score, sixty consecutive
 * filenames landed in two distinct buckets, so a "photo quality" spread looked like a
 * coin flip between two numbers.
 *
 * The finaliser is the avalanche step from MurmurHash3: every input bit ends up
 * affecting every output bit, so adjacent inputs produce unrelated seeds.
 */
export function hashString(input: string): number {
	let hash = 0;
	for (let i = 0; i < input.length; i += 1) {
		hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
	}
	// MurmurHash3 32-bit finaliser.
	hash ^= hash >>> 15;
	hash = Math.imul(hash, 2246822507);
	hash ^= hash >>> 13;
	hash = Math.imul(hash, 3266489909);
	hash ^= hash >>> 16;
	return Math.abs(hash | 0);
}

/**
 * A Lehmer generator seeded from `seed`.
 *
 * Deliberately small and old: the point is reproducibility, not statistical quality,
 * and a caller that needs cryptographic randomness is doing something else entirely.
 */
export function seededRandom(seed: number): () => number {
	let state = seed % 2147483647;
	if (state <= 0) state += 2147483646;
	const next = () => {
		state = (state * 16807) % 2147483647;
		return (state - 1) / 2147483646;
	};
	// The first draw of a Lehmer generator is a linear function of the seed
	// (`16807 * seed mod 2^31-1`), so two related seeds give two related outputs no
	// matter how well the seed was hashed. Warming up discards that first step.
	for (let i = 0; i < 4; i += 1) next();
	return next;
}

/**
 * An integer in `[min, max]`, derived from `seed` rather than drawn.
 *
 * This is the replacement for `min + Math.floor(Math.random() * span)`: the spread is
 * the same, so a heuristic that used to say "somewhere between 75 and 99" still says
 * that — it now says the same number every time for the same photo.
 */
export function jitter(seed: string, min: number, max: number): number {
	const random = seededRandom(hashString(seed));
	return min + Math.floor(random() * (max - min + 1));
}

/** A float in `[min, max)`, derived from `seed`. */
export function jitterFloat(seed: string, min: number, max: number): number {
	const random = seededRandom(hashString(seed));
	return min + random() * (max - min);
}
