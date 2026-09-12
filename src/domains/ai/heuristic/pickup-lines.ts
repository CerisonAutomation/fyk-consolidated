/**
 * pickup-lines.ts
 * 8 pickup lines. Returns 4 random lines each call.
 */

const ALL_LINES: string[] = [
  "Are you a magician? Because every time I look at you, everyone else disappears.",
  "Do you have a map? Because I just got lost in your eyes.",
  "Are you a parking ticket? Because you've got 'fine' written all over you.",
  "If you were a vegetable, you'd be a cute-cumber.",
  "Do you believe in love at first sight, or should I walk by again?",
  "Are you a campfire? Because you're hot and I want s'more.",
  "Is your name Wi-Fi? Because I'm really feeling a connection.",
  "Do you have a Band-Aid? Because I just scraped my knee falling for you.",
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generatePickupLines(): string[] {
  const now = Date.now();
  const rng = seededRandom(now % 2147483647);

  const indices = [0, 1, 2, 3, 4, 5, 6, 7];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, 4).map((i) => ALL_LINES[i]);
}
