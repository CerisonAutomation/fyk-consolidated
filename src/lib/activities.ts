/**
 * Activities & availability.
 *
 * The core reframe: FYK is still a hookup app, but "what are you up for right now"
 * is a first-class, time-boxed signal rather than something buried in a bio.
 * Anyone can raise their hand for coffee, a beach afternoon, a cinema seat, a
 * PlayStation session, showing a visitor round, a date, a group chill — or a hookup.
 */

export type ActivityKind = "Chill" | "Active" | "Night" | "Culture" | "Outdoors" | "Food" | "Travel" | "Intimate";

export type Activity = {
  id: string;
  label: string;
  emoji: string;
  kind: ActivityKind;
  /** Typical length in minutes — pre-fills the availability window. */
  minutes: number;
  /** Requires MATURE or higher to see or publish. */
  nsfw?: boolean;
  blurb: string;
};

const a = (
  id: string, label: string, emoji: string, kind: ActivityKind, minutes: number, blurb: string,
  nsfw = false,
): Activity => ({ id, label, emoji, kind, minutes, blurb, nsfw });

export const ACTIVITIES: Activity[] = [
  // Chill
  a("coffee", "Coffee", "☕", "Chill", 60, "A flat white and an actual conversation."),
  a("chill", "Group chill", "🛋️", "Chill", 180, "Sofa, snacks, nobody performing."),
  a("walk", "Go for a walk", "🚶", "Chill", 60, "Wander and talk. Low stakes."),
  a("dogwalk", "Dog walk", "🐕", "Chill", 45, "Bring the dog. The dog is the point."),
  a("study", "Study / cowork", "💻", "Chill", 120, "Parallel laptops, occasional chat."),
  a("chat", "Just chat", "💬", "Chill", 30, "Online only, no plans needed."),

  // Active
  a("gym", "Gym session", "🏋️", "Active", 75, "Lift together, spot each other."),
  a("run", "Run", "🏃", "Active", 45, "Any pace. Nobody gets dropped."),
  a("swim", "Swim", "🏊", "Active", 60, "Pool or sea, your call."),
  a("padel", "Padel / tennis", "🎾", "Active", 90, "Court booked or find one."),
  a("football", "Five-a-side", "⚽", "Active", 90, "Need players, all levels."),
  a("hike", "Hike", "🥾", "Outdoors", 180, "Trail, water, decent shoes."),
  a("cycle", "Cycle", "🚴", "Active", 120, "Road or coastal loop."),

  // Outdoors
  a("beach", "Beach", "🏖️", "Outdoors", 240, "Towel, sea, zero agenda."),
  a("boat", "Boat day", "⛵", "Outdoors", 300, "Out on the water for the day."),
  a("sunset", "Catch the sunset", "🌅", "Outdoors", 60, "Somewhere with a view."),
  a("photo", "Photo walk", "📷", "Outdoors", 120, "Shoot the city, swap edits."),

  // Culture
  a("cinema", "Cinema", "🎬", "Culture", 150, "A film and an argument afterwards."),
  a("gaming", "PlayStation / gaming", "🎮", "Culture", 180, "Couch co-op or online."),
  a("boardgames", "Board games", "🎲", "Culture", 150, "Bring a game or use mine."),
  a("museum", "Museum / gallery", "🖼️", "Culture", 120, "Wander, judge the curation."),
  a("gig", "Live music", "🎸", "Culture", 180, "Spare ticket or just going."),
  a("karaoke", "Karaoke", "🎤", "Night", 150, "No talent required."),
  a("tourguide", "Show me around", "🗺️", "Travel", 180, "New here — be my guide."),
  a("guiding", "I'll guide you", "🧭", "Travel", 180, "Local, happy to show people the good bits."),
  a("language", "Language swap", "🗣️", "Culture", 60, "Half in yours, half in mine."),

  // Food
  a("dinner", "Dinner", "🍽️", "Food", 120, "Somewhere decent, split the bill."),
  a("brunch", "Brunch", "🥞", "Food", 120, "Long table, big plates."),
  a("cook", "Cook together", "🍳", "Food", 150, "You chop, I'll burn something."),
  a("streetfood", "Street food crawl", "🌮", "Food", 120, "Four stops, no cutlery."),

  // Night
  a("drinks", "Drinks", "🍻", "Night", 150, "One bar, maybe three."),
  a("club", "Club night", "🪩", "Night", 300, "Out late, home whenever."),
  a("afters", "Afters", "🌃", "Night", 240, "When the club shuts.", true),

  // Travel
  a("travelbuddy", "Travel buddy", "✈️", "Travel", 1440, "Trip coming up, want company."),
  a("roadtrip", "Road trip", "🚗", "Travel", 480, "Car, playlist, no fixed plan."),
  a("airport", "Airport run", "🛄", "Travel", 90, "Lift there or back."),

  // Dating & intimate
  a("date", "A proper date", "🌹", "Intimate", 180, "Planned, thoughtful, phones away."),
  a("firstdate", "First date", "💫", "Intimate", 90, "Somewhere public, see how it goes."),
  a("cuddle", "Cuddle / no pressure", "🫂", "Intimate", 120, "Warmth without expectation.", true),
  a("hookup", "Hookup", "🔥", "Intimate", 90, "Direct, consensual, no small talk.", true),
  a("hosting", "Hosting", "🏠", "Intimate", 120, "My place, my rules, ask first.", true),
  a("travel_to", "I'll travel to you", "🚕", "Intimate", 120, "Happy to come to yours.", true),
  a("sauna", "Sauna", "🧖", "Intimate", 120, "Steam and quiet.", true),
];

export const ACTIVITY_KINDS: ActivityKind[] = ["Chill", "Active", "Outdoors", "Culture", "Food", "Night", "Travel", "Intimate"];

export const activityById = (id: string) => ACTIVITIES.find((x) => x.id === id);

export const activitiesFor = (kind: ActivityKind) => ACTIVITIES.filter((x) => x.kind === kind);

/** Server-side rule: intimate activities need the viewer to have opted into mature content. */
export function visibleActivities(level: "CLEAN" | "MATURE" | "EXPLICIT"): Activity[] {
  return ACTIVITIES.filter((x) => !x.nsfw || level !== "CLEAN");
}

/* ------------------------------ availability ---------------------------- */

export type WhereMode = "out" | "mine" | "yours" | "either";

export const WHERE_LABEL: Record<WhereMode, string> = {
  out: "Out somewhere",
  mine: "At mine",
  yours: "At yours",
  either: "Either works",
};

export type Availability = {
  activityIds: string[];
  note: string;
  where: WhereMode;
  /** Epoch ms. Availability auto-expires — that's the whole point. */
  until: number;
  /** Optional cap for group things. */
  spots?: number;
};

export const WINDOWS = [
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
  { label: "Tonight", minutes: 420 },
  { label: "All day", minutes: 720 },
];

export function timeLeft(until: number): string {
  const ms = until - Date.now();
  if (ms <= 0) return "Expired";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m left` : `${hours}h left`;
}

export function isLive(av: Availability | undefined | null): av is Availability {
  return !!av && av.until > Date.now();
}

/** Deterministic seeded availability so the board is populated on first load. */
export function seedAvailability(personId: string, index: number): Availability | null {
  let h = 2166136261;
  for (let i = 0; i < personId.length; i++) {
    h ^= personId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = (h >>> 0) / 4294967295;
  if (r > 0.42) return null; // only some people are actively available

  const pool = ACTIVITIES.filter((x) => !x.nsfw);
  const spicy = ACTIVITIES.filter((x) => x.nsfw);
  const picks = [
    pool[(index * 7 + 3) % pool.length]!.id,
    pool[(index * 13 + 11) % pool.length]!.id,
    ...(r > 0.3 ? [spicy[(index * 5) % spicy.length]!.id] : []),
  ];

  const NOTES = [
    "Free after 6, message me.",
    "Working from a café till three — join me.",
    "Car's free if anyone wants the beach.",
    "Two spare controllers.",
    "Spare ticket going, first to reply.",
    "New in town, show me somewhere good.",
    "Low energy today, happy with quiet company.",
    "Booked a court for two.",
    "",
  ];

  return {
    activityIds: Array.from(new Set(picks)),
    note: NOTES[index % NOTES.length]!,
    where: (["out", "mine", "yours", "either"] as WhereMode[])[index % 4]!,
    until: Date.now() + (30 + Math.floor(r * 600)) * 60_000,
    spots: r > 0.34 ? 2 + (index % 5) : undefined,
  };
}
