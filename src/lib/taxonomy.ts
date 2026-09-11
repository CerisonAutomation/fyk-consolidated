/**
 * FYK tag taxonomy — community-standard, non-stigmatising language.
 * Kink tags carry `nsfw` and are hidden unless the viewer opted into MATURE/EXPLICIT.
 */

export type TagKind = "TRIBE" | "INTEREST" | "KINK" | "LIFESTYLE" | "LOOKING_FOR" | "COMMUNITY";
export type Explicitness = "CLEAN" | "MATURE" | "EXPLICIT";

export type Tag = {
  id: string;
  label: string;
  kind: TagKind;
  nsfw?: boolean;
  /** Minimum viewer exposure level required to render this tag. */
  level?: Explicitness;
  emoji?: string;
};

const t = (id: string, label: string, kind: TagKind, extra: Partial<Tag> = {}): Tag => ({
  id,
  label,
  kind,
  ...extra,
});

export const TRIBES: Tag[] = [
  t("bear", "Bear", "TRIBE", { emoji: "🐻" }),
  t("cub", "Cub", "TRIBE"),
  t("otter", "Otter", "TRIBE"),
  t("wolf", "Wolf", "TRIBE"),
  t("daddy", "Daddy", "TRIBE"),
  t("jock", "Jock", "TRIBE"),
  t("twink", "Twink", "TRIBE"),
  t("chub", "Chub", "TRIBE"),
  t("muscle", "Muscle", "TRIBE"),
  t("silver", "Silver", "TRIBE"),
  t("geek", "Geek", "TRIBE"),
  t("leather", "Leather", "TRIBE", { emoji: "🖤" }),
  t("rugged", "Rugged", "TRIBE"),
  t("discreet", "Discreet", "TRIBE"),
  t("trans", "Trans", "TRIBE", { emoji: "🏳️‍⚧️" }),
  t("nonbinary", "Non-binary", "TRIBE"),
  t("poz", "Poz & proud", "TRIBE"),
  t("sober", "Sober", "TRIBE"),
];

export const LOOKING_FOR: Tag[] = [
  t("chat", "Chat", "LOOKING_FOR", { emoji: "💬" }),
  t("friends", "Friends", "LOOKING_FOR"),
  t("dates", "Dates", "LOOKING_FOR", { emoji: "🌹" }),
  t("relationship", "Relationship", "LOOKING_FOR"),
  t("networking", "Networking", "LOOKING_FOR" ),
  t("workout", "Gym buddy", "LOOKING_FOR"),
  t("travel-buddy", "Travel buddy", "LOOKING_FOR"),
  t("right-now", "Right now", "LOOKING_FOR", { level: "MATURE" }),
  t("hosting", "Hosting", "LOOKING_FOR", { level: "MATURE" }),
  t("open-to", "Open to anything", "LOOKING_FOR", { level: "MATURE" }),
];

export const INTERESTS: Tag[] = [
  t("gym", "Gym", "INTEREST", { emoji: "🏋️" }),
  t("running", "Running", "INTEREST"),
  t("swimming", "Swimming", "INTEREST"),
  t("hiking", "Hiking", "INTEREST"),
  t("cycling", "Cycling", "INTEREST"),
  t("food", "Foodie", "INTEREST", { emoji: "🍽️" }),
  t("coffee", "Coffee", "INTEREST", { emoji: "☕" }),
  t("wine", "Wine", "INTEREST"),
  t("music", "Music", "INTEREST", { emoji: "🎧" }),
  t("techno", "Techno", "INTEREST"),
  t("film", "Film", "INTEREST", { emoji: "🎬" }),
  t("books", "Books", "INTEREST"),
  t("art", "Art", "INTEREST", { emoji: "🎨" }),
  t("gaming", "Gaming", "INTEREST", { emoji: "🎮" }),
  t("travel", "Travel", "INTEREST", { emoji: "✈️" }),
  t("dogs", "Dogs", "INTEREST", { emoji: "🐕" }),
  t("cats", "Cats", "INTEREST" ),
  t("drag", "Drag", "INTEREST", { emoji: "👑" }),
  t("sailing", "Sailing", "INTEREST" ),
  t("tattoos", "Tattoos", "INTEREST" ),
  t("cooking", "Cooking", "INTEREST"),
  t("photography", "Photography", "INTEREST", { emoji: "📷" }),
];

export const LIFESTYLE: Tag[] = [
  t("single", "Single", "LIFESTYLE"),
  t("open-rel", "Open relationship", "LIFESTYLE"),
  t("poly", "Polyamorous", "LIFESTYLE"),
  t("monogamous", "Monogamous", "LIFESTYLE"),
  t("no-smoke", "Non-smoker", "LIFESTYLE"),
  t("420", "420 friendly", "LIFESTYLE", { level: "MATURE" }),
  t("sober-life", "Sober lifestyle", "LIFESTYLE"),
  t("vegan", "Vegan", "LIFESTYLE"),
  t("night-owl", "Night owl", "LIFESTYLE"),
  t("early-bird", "Early bird", "LIFESTYLE"),
  t("dad", "Parent", "LIFESTYLE"),
  t("expat", "Expat", "LIFESTYLE"),
];

export const COMMUNITY: Tag[] = [
  t("pride", "Pride organiser", "COMMUNITY", { emoji: "🏳️‍🌈" }),
  t("volunteer", "Volunteer", "COMMUNITY"),
  t("activist", "Activist", "COMMUNITY"),
  t("mentor", "Mentor", "COMMUNITY"),
  t("newcomer", "New in town", "COMMUNITY"),
  t("host-events", "Event host", "COMMUNITY"),
  t("sports-club", "Sports club", "COMMUNITY"),
  t("choir", "Choir & arts", "COMMUNITY"),
];

/**
 * Kink & fetish tags. Consent-forward wording, no shaming, no medicalising.
 * All are nsfw and require the viewer to have opted into MATURE (or EXPLICIT).
 */
export const KINKS: Tag[] = [
  t("leather-k", "Leather", "KINK", { nsfw: true, level: "MATURE" }),
  t("rubber", "Rubber & latex", "KINK", { nsfw: true, level: "MATURE" }),
  t("gear", "Gear & uniform", "KINK", { nsfw: true, level: "MATURE" }),
  t("sportswear", "Sportswear", "KINK", { nsfw: true, level: "MATURE" }),
  t("sneakers", "Sneakers", "KINK", { nsfw: true, level: "MATURE" }),
  t("dom", "Dominant", "KINK", { nsfw: true, level: "MATURE" }),
  t("sub", "Submissive", "KINK", { nsfw: true, level: "MATURE" }),
  t("switch", "Switch", "KINK", { nsfw: true, level: "MATURE" }),
  t("bondage", "Bondage", "KINK", { nsfw: true, level: "MATURE" }),
  t("impact", "Impact play", "KINK", { nsfw: true, level: "EXPLICIT" }),
  t("edging", "Edging", "KINK", { nsfw: true, level: "EXPLICIT" }),
  t("roleplay", "Role play", "KINK", { nsfw: true, level: "MATURE" }),
  t("pup", "Pup play", "KINK", { nsfw: true, level: "MATURE", emoji: "🐶" }),
  t("ddlb", "Caregiver dynamic", "KINK", { nsfw: true, level: "EXPLICIT" }),
  t("exhib", "Exhibitionism", "KINK", { nsfw: true, level: "EXPLICIT" }),
  t("voyeur", "Voyeurism", "KINK", { nsfw: true, level: "EXPLICIT" }),
  t("group", "Group play", "KINK", { nsfw: true, level: "EXPLICIT" }),
  t("massage", "Sensual massage", "KINK", { nsfw: true, level: "MATURE" }),
  t("worship", "Body worship", "KINK", { nsfw: true, level: "MATURE" }),
  t("tickle", "Tickling", "KINK", { nsfw: true, level: "MATURE" }),
  t("wax", "Wax play", "KINK", { nsfw: true, level: "EXPLICIT" }),
  t("shibari", "Shibari", "KINK", { nsfw: true, level: "EXPLICIT" }),
  t("chastity", "Chastity", "KINK", { nsfw: true, level: "EXPLICIT" }),
  t("feet", "Feet", "KINK", { nsfw: true, level: "MATURE" }),
  t("beard", "Beard & fur", "KINK", { nsfw: true, level: "MATURE" }),
  t("cuddle", "Cuddling", "KINK", { nsfw: true, level: "MATURE" }),
];

export const ALL_TAGS: Tag[] = [
  ...LOOKING_FOR,
  ...TRIBES,
  ...INTERESTS,
  ...LIFESTYLE,
  ...COMMUNITY,
  ...KINKS,
];

export const TAG_GROUPS: { kind: TagKind; title: string; note?: string; tags: Tag[] }[] = [
  { kind: "LOOKING_FOR", title: "Looking for", tags: LOOKING_FOR },
  { kind: "TRIBE", title: "Tribes", note: "Self-described, never assigned.", tags: TRIBES },
  { kind: "INTEREST", title: "Interests", tags: INTERESTS },
  { kind: "LIFESTYLE", title: "Lifestyle", tags: LIFESTYLE },
  { kind: "COMMUNITY", title: "Community", tags: COMMUNITY },
  {
    kind: "KINK",
    title: "Kinks & dynamics",
    note: "Only shown to people who opted into mature content. Consent first, always.",
    tags: KINKS,
  },
];

const LEVEL_RANK: Record<Explicitness, number> = { CLEAN: 0, MATURE: 1, EXPLICIT: 2 };

/** Server-equivalent visibility rule: a tag renders only if the viewer opted in far enough. */
export function tagVisible(tag: Tag, viewerLevel: Explicitness): boolean {
  const required = tag.level ?? "CLEAN";
  return LEVEL_RANK[viewerLevel] >= LEVEL_RANK[required];
}

export function filterTags(ids: string[], viewerLevel: Explicitness): Tag[] {
  return ids
    .map((id) => ALL_TAGS.find((x) => x.id === id))
    .filter((x): x is Tag => !!x && tagVisible(x, viewerLevel));
}

export function tagById(id: string): Tag | undefined {
  return ALL_TAGS.find((t2) => t2.id === id);
}

/** Weighted tag overlap → 0-100 compatibility contribution. Documented in docs/compatibility.md. */
export function tagOverlapScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let hits = 0;
  let weight = 0;
  for (const id of a) {
    if (!setB.has(id)) continue;
    const tag = tagById(id);
    hits += 1;
    weight += tag?.kind === "LOOKING_FOR" ? 2.2 : tag?.kind === "KINK" ? 1.6 : 1;
  }
  if (!hits) return 0;
  return Math.min(100, Math.round((weight / Math.max(3, Math.min(a.length, b.length))) * 42));
}
