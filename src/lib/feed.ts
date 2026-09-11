/**
 * The board — user posts.
 * Anyone can put something up: an open invite, a spare ticket, a lift to the
 * airport, a photo, a question. Posts expire so the board stays current instead
 * of turning into an archive nobody reads.
 */

export type PostKind = "invite" | "photo" | "text" | "ask" | "offer";

export type Post = {
  id: string;
  authorId: string;
  kind: PostKind;
  body: string;
  activityId?: string;
  photo?: number;
  /** Local object URL when the user posted it themselves. */
  photoUrl?: string;
  city: string;
  area: string;
  createdMinutesAgo: number;
  expiresInMinutes: number;
  spots?: number;
  joined: string[];
  likes: number;
  comments: { id: string; authorId: string; body: string; minutesAgo: number }[];
  nsfw?: boolean;
};

export const SEED_POSTS: Post[] = [
  {
    id: "p1",
    authorId: "kai",
    kind: "invite",
    body: "Driving to Golden Bay around 2. Two seats free — bring a towel and something to drink.",
    activityId: "beach",
    photo: 30595072,
    city: "Valletta",
    area: "St Julian's",
    createdMinutesAgo: 18,
    expiresInMinutes: 180,
    spots: 2,
    joined: ["noah"],
    likes: 14,
    comments: [
      { id: "c1", authorId: "noah", body: "In. What time are you heading back?", minutesAgo: 12 },
      { id: "c2", authorId: "kai", body: "Probably 7ish, flexible.", minutesAgo: 9 },
    ],
  },
  {
    id: "p2",
    authorId: "theo",
    kind: "offer",
    body: "Spare ticket for the film club Thursday. Free to whoever actually shows up.",
    activityId: "cinema",
    city: "Valletta",
    area: "Msida",
    createdMinutesAgo: 44,
    expiresInMinutes: 600,
    spots: 1,
    joined: [],
    likes: 9,
    comments: [{ id: "c3", authorId: "sam", body: "Yes please if it's still going.", minutesAgo: 20 }],
  },
  {
    id: "p3",
    authorId: "marcus",
    kind: "photo",
    body: "Golden hour off the bastions. Same spot every week and it never gets old.",
    photo: 37117204,
    city: "Valletta",
    area: "Floriana",
    createdMinutesAgo: 95,
    expiresInMinutes: 1440,
    joined: [],
    likes: 63,
    comments: [
      { id: "c4", authorId: "dario", body: "That light is unreal.", minutesAgo: 70 },
      { id: "c5", authorId: "jasper", body: "Where exactly? I keep missing it.", minutesAgo: 40 },
    ],
  },
  {
    id: "p4",
    authorId: "adrian",
    kind: "ask",
    body: "Moved here nine days ago and I know precisely nobody. Anyone free for a coffee that isn't a job interview?",
    activityId: "coffee",
    city: "Valletta",
    area: "Żejtun",
    createdMinutesAgo: 130,
    expiresInMinutes: 720,
    joined: ["felix", "sam"],
    likes: 41,
    comments: [
      { id: "c6", authorId: "felix", body: "Lot Sixty One tomorrow at 11? I'll be the one with the loud shirt.", minutesAgo: 100 },
    ],
  },
  {
    id: "p5",
    authorId: "rafael",
    kind: "invite",
    body: "Two spare controllers, FC and Tekken. Doors open from 8, bring beer or don't.",
    activityId: "gaming",
    city: "Valletta",
    area: "Ħamrun",
    createdMinutesAgo: 26,
    expiresInMinutes: 300,
    spots: 3,
    joined: ["luca"],
    likes: 22,
    comments: [],
  },
  {
    id: "p6",
    authorId: "diego",
    kind: "invite",
    body: "Harbour run at 6:30 tomorrow. 5K, easy pace, coffee after. Absolute beginners very welcome.",
    activityId: "run",
    photo: 17594841,
    city: "Valletta",
    area: "Sliema",
    createdMinutesAgo: 210,
    expiresInMinutes: 900,
    spots: 8,
    joined: ["marcus", "ethan", "noah"],
    likes: 35,
    comments: [{ id: "c7", authorId: "ethan", body: "First time running in months, be gentle.", minutesAgo: 150 }],
  },
  {
    id: "p7",
    authorId: "omar",
    kind: "offer",
    body: "Doing airport runs all week — I work nights anyway. If you need a lift at a stupid hour, ask.",
    activityId: "airport",
    city: "Valletta",
    area: "Paola",
    createdMinutesAgo: 300,
    expiresInMinutes: 2880,
    joined: [],
    likes: 58,
    comments: [{ id: "c8", authorId: "anton", body: "This is genuinely the nicest thing on here.", minutesAgo: 240 }],
  },
  {
    id: "p8",
    authorId: "liam",
    kind: "text",
    body: "Reminder that you can just say no to things and the world keeps turning. Took me thirty-three years.",
    city: "Valletta",
    area: "Pietà",
    createdMinutesAgo: 400,
    expiresInMinutes: 1440,
    joined: [],
    likes: 127,
    comments: [{ id: "c9", authorId: "theo", body: "Needed this today.", minutesAgo: 300 }],
  },
  {
    id: "p9",
    authorId: "mateo",
    kind: "ask",
    body: "Flying to Berlin next month for four days. Anyone been recently — what's actually worth doing?",
    activityId: "travelbuddy",
    city: "Naxxar",
    area: "Iklin",
    createdMinutesAgo: 520,
    expiresInMinutes: 4320,
    joined: [],
    likes: 17,
    comments: [{ id: "c10", authorId: "jonas", body: "Sending you a list. Skip the obvious one.", minutesAgo: 420 }],
  },
  {
    id: "p10",
    authorId: "ravi",
    kind: "invite",
    body: "Free tonight, hosting, mature crowd only. Message before turning up — consent and manners required.",
    activityId: "hosting",
    city: "Valletta",
    area: "Żabbar",
    createdMinutesAgo: 12,
    expiresInMinutes: 240,
    spots: 2,
    joined: [],
    likes: 31,
    comments: [],
    nsfw: true,
  },
  {
    id: "p11",
    authorId: "enzo",
    kind: "offer",
    body: "Local, been here forty years, happy to show visitors the parts that aren't in the guidebook. No charge, obviously.",
    activityId: "guiding",
    photo: 17826697,
    city: "Naxxar",
    area: "Naxxar",
    createdMinutesAgo: 640,
    expiresInMinutes: 4320,
    spots: 4,
    joined: ["adrian"],
    likes: 74,
    comments: [{ id: "c11", authorId: "adrian", body: "Taking you up on this.", minutesAgo: 500 }],
  },
  {
    id: "p12",
    authorId: "jasper",
    kind: "photo",
    body: "Finished the mural on Old Bakery Street. Six weeks of my life, worth every hour.",
    photo: 19186825,
    city: "Valletta",
    area: "Marsa",
    createdMinutesAgo: 700,
    expiresInMinutes: 2880,
    joined: [],
    likes: 96,
    comments: [{ id: "c12", authorId: "marcus", body: "Walked past it this morning. Stunning.", minutesAgo: 600 }],
  },
];

export const POST_KIND_META: Record<PostKind, { label: string; emoji: string; hint: string }> = {
  invite: { label: "Open invite", emoji: "🙋", hint: "Something you're doing that others can join." },
  offer: { label: "Offering", emoji: "🎁", hint: "A spare ticket, a lift, your local knowledge." },
  ask: { label: "Looking for", emoji: "🔎", hint: "You need company, advice or a hand." },
  photo: { label: "Photo", emoji: "📸", hint: "Something you saw or made." },
  text: { label: "Just saying", emoji: "💭", hint: "A thought, no agenda." },
};

export function postAge(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}
