/**
 * FYK demo dataset.
 * Imagery is served from Pexels CDN (free licence) so the single-file build stays light.
 */

export const px = (id: number, w: number, h: number, ext: "jpeg" | "png" = "jpeg") =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${ext}?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${h}`;

export type Explicitness = "CLEAN" | "MATURE" | "EXPLICIT";

export type Person = {
  id: string;
  name: string;
  age: number;
  photo: number;
  gallery: number[];
  km: number;
  online: boolean;
  lastActive: string;
  verified: boolean;
  hosting: boolean;
  traveling?: string;
  city: string;
  area: string;
  headline: string;
  bio: string;
  tags: string[];
  lookingFor: string[];
  heightCm: number;
  bodyType: string;
  position: string;
  pronouns: string;
  privatePhotos: number;
  match: number;
};

const mk = (
  id: string,
  name: string,
  age: number,
  photo: number,
  km: number,
  city: string,
  area: string,
  extra: Partial<Person> = {},
): Person => ({
  id,
  name,
  age,
  photo,
  gallery: extra.gallery ?? [photo],
  km,
  online: extra.online ?? false,
  lastActive: extra.lastActive ?? "Today",
  verified: extra.verified ?? false,
  hosting: extra.hosting ?? false,
  city,
  area,
  headline: extra.headline ?? "Here for good company.",
  bio:
    extra.bio ??
    "Coffee in the morning, something louder at night. Straightforward, kind, and allergic to small talk that goes nowhere.",
  tags: extra.tags ?? ["Community", "Travel"],
  lookingFor: extra.lookingFor ?? ["Chat", "Dates"],
  heightCm: extra.heightCm ?? 180,
  bodyType: extra.bodyType ?? "Athletic",
  position: extra.position ?? "Versatile",
  pronouns: extra.pronouns ?? "he/him",
  privatePhotos: extra.privatePhotos ?? 0,
  match: extra.match ?? 74,
  ...extra,
});

export const people: Person[] = [
  mk("marcus", "Marcus", 29, 10340632, 0.64, "Valletta", "Floriana", {
    online: true,
    lastActive: "Online now",
    gallery: [10340632, 12694092, 21369556],
    headline: "Sunset swims and late dinners.",
    bio: "Architect by day, terrible cook by night. I like people who say what they mean. Big on live music and long walks that turn into longer conversations.",
    tags: ["Athletic", "Music", "Foodie", "Community"],
    lookingFor: ["Dates", "Friends"],
    heightCm: 186,
    bodyType: "Muscular",
    match: 91,
    privatePhotos: 3,
  }),
  mk("diego", "Diego", 34, 8554876, 1.77, "Valletta", "Sliema", {
    verified: true,
    lastActive: "12m ago",
    gallery: [8554876, 17924406, 36085104],
    headline: "Gym at six, negroni at nine.",
    bio: "Physio, Spaniard, unrepentant beach person. I train hard and rest harder. Looking for someone to share Sunday with.",
    tags: ["Athletic", "Gym", "Travel", "Dating"],
    lookingFor: ["Dates", "Relationship"],
    heightCm: 183,
    bodyType: "Muscular",
    match: 88,
    privatePhotos: 4,
  }),
  mk("theo", "Theo", 26, 33408994, 3.22, "Valletta", "Msida", {
    online: true,
    lastActive: "Online now",
    gallery: [33408994, 11214825, 15407895],
    headline: "Warm, curious, slightly nocturnal.",
    bio: "Bar manager who reads too much. Ask me about the best pastizzi on the island and I will absolutely go on for ten minutes.",
    tags: ["Community", "Nightlife", "Books"],
    lookingFor: ["Chat", "Dates"],
    heightCm: 179,
    bodyType: "Average",
    match: 84,
    privatePhotos: 5,
  }),
  mk("sam", "Sam", 31, 13003987, 5.31, "Valletta", "Gżira", {
    lastActive: "1h ago",
    gallery: [13003987, 11628047],
    headline: "Quietly funny. Loudly loyal.",
    tags: ["Film", "Coffee", "Community"],
    heightCm: 177,
    bodyType: "Slim",
    match: 79,
  }),
  mk("kai", "Kai", 28, 7673591, 1.45, "Valletta", "St Julian's", {
    online: true,
    hosting: true,
    lastActive: "Online now",
    gallery: [7673591, 29981151, 10551491],
    headline: "Hosting tonight, no pressure.",
    bio: "Personal trainer. Direct but never rude. If we click, we click — if not, still nice to meet you.",
    tags: ["Athletic", "Gym", "Hosting"],
    lookingFor: ["Right now", "Chat"],
    heightCm: 181,
    bodyType: "Muscular",
    match: 86,
    privatePhotos: 6,
  }),
  mk("noah", "Noah", 27, 35746676, 1.93, "Valletta", "Ta' Xbiex", {
    online: true,
    lastActive: "Online now",
    gallery: [35746676, 6149790, 30365037],
    headline: "Softie with a deadlift habit.",
    tags: ["Community", "Gym", "Dogs"],
    heightCm: 175,
    bodyType: "Toned",
    match: 82,
    privatePhotos: 2,
  }),
  mk("liam", "Liam", 33, 17924406, 2.41, "Valletta", "Pietà", {
    verified: true,
    online: true,
    lastActive: "Online now",
    gallery: [17924406, 17924332, 17924324],
    headline: "Ink, iron, and good manners.",
    tags: ["Athletic", "Tattoos", "Gym"],
    heightCm: 184,
    bodyType: "Muscular",
    match: 80,
    privatePhotos: 4,
  }),
  mk("jasper", "Jasper", 25, 11628047, 2.9, "Valletta", "Marsa", {
    online: true,
    lastActive: "Online now",
    gallery: [11628047, 38977010],
    headline: "Design student. Terrible at chess.",
    tags: ["Art", "Community", "Coffee"],
    heightCm: 174,
    bodyType: "Slim",
    match: 76,
  }),
  mk("ethan", "Ethan", 30, 35705836, 3.86, "Valletta", "Birkirkara", {
    lastActive: "35m ago",
    gallery: [35705836, 15407895],
    headline: "Cycling, cinema, cheap wine.",
    tags: ["Cycling", "Film", "Travel"],
    heightCm: 182,
    bodyType: "Average",
    match: 73,
  }),
  mk("rafael", "Rafael", 32, 8612474, 4.18, "Valletta", "Ħamrun", {
    online: true,
    lastActive: "Online now",
    gallery: [8612474, 17210041],
    headline: "Boxer. Gentle outside the ring.",
    tags: ["Athletic", "Gym", "Music"],
    heightCm: 180,
    bodyType: "Muscular",
    match: 85,
    privatePhotos: 3,
  }),
  mk("luca", "Luca", 28, 19186825, 4.5, "Valletta", "Qormi", {
    online: true,
    lastActive: "Online now",
    gallery: [19186825, 20723489],
    headline: "Chasing every sunset going.",
    tags: ["Nightlife", "Travel", "Community"],
    heightCm: 178,
    match: 81,
  }),
  mk("anton", "Anton", 28, 7408436, 5.15, "Valletta", "Mosta", {
    lastActive: "2h ago",
    gallery: [7408436, 5405438],
    headline: "Sailing instructor. Sun-bleached.",
    tags: ["Outdoors", "Travel", "Sport"],
    heightCm: 186,
    match: 70,
  }),
  mk("enzo", "Enzo", 32, 11214825, 5.79, "Naxxar", "Naxxar", {
    lastActive: "Yesterday",
    gallery: [11214825, 7510701],
    headline: "Beard, bikes, and bad puns.",
    tags: ["Bikes", "Community", "Beards"],
    heightCm: 181,
    match: 72,
  }),
  mk("mateo", "Mateo", 29, 17910791, 6.11, "Naxxar", "Iklin", {
    online: true,
    lastActive: "Online now",
    gallery: [17910791, 16166472],
    headline: "Always up for a spontaneous trip.",
    tags: ["Travel", "Foodie", "Dating"],
    heightCm: 177,
    match: 87,
    privatePhotos: 2,
  }),
  mk("dario", "Dario", 31, 7510697, 2.09, "Valletta", "Valletta", {
    verified: true,
    online: true,
    lastActive: "Online now",
    gallery: [7510697, 7510690, 7510696],
    headline: "Rooftop nights, quiet mornings.",
    tags: ["Athletic", "Community", "Travel"],
    heightCm: 182,
    match: 92,
    privatePhotos: 3,
  }),
  mk("felix", "Felix", 27, 37159572, 6.6, "Naxxar", "Lija", {
    lastActive: "3h ago",
    gallery: [37159572, 9466093],
    headline: "Loud shirts, soft heart.",
    tags: ["Art", "Community", "Music"],
    heightCm: 173,
    bodyType: "Slim",
    match: 69,
  }),
  mk("omar", "Omar", 35, 21369556, 7.24, "Valletta", "Paola", {
    verified: true,
    lastActive: "Yesterday",
    gallery: [21369556, 12694092],
    headline: "Tattooist. Long-form conversations.",
    tags: ["Tattoos", "Art", "Bears"],
    heightCm: 188,
    bodyType: "Stocky",
    match: 75,
    privatePhotos: 5,
  }),
  mk("ravi", "Ravi", 30, 27398012, 7.88, "Valletta", "Żabbar", {
    online: true,
    lastActive: "Online now",
    gallery: [27398012, 14833446],
    headline: "Neon, techno, and hummus.",
    tags: ["Nightlife", "Music", "Community"],
    heightCm: 176,
    match: 78,
  }),
  mk("jonas", "Jonas", 36, 1601241, 8.36, "Naxxar", "Mġarr", {
    lastActive: "Yesterday",
    gallery: [1601241, 30365037],
    headline: "Woodworker. Early riser.",
    tags: ["Outdoors", "Crafts", "Dads"],
    heightCm: 185,
    bodyType: "Stocky",
    match: 66,
  }),
  mk("adrian", "Adrian", 24, 6515741, 9.01, "Valletta", "Żejtun", {
    online: true,
    lastActive: "Online now",
    gallery: [6515741, 17910791],
    headline: "New in town, show me around?",
    tags: ["Community", "Coffee", "Travel"],
    heightCm: 172,
    bodyType: "Slim",
    match: 71,
  }),
];

/* --------------------------- explore cities --------------------------- */

export type City = { id: string; name: string; country: string; flag: string; guys: number; photo: number };

export const cities: City[] = [
  { id: "valletta", name: "Valletta", country: "Malta", flag: "🇲🇹", guys: 248, photo: 37117204 },
  { id: "naxxar", name: "Naxxar", country: "Malta", flag: "🇲🇹", guys: 96, photo: 17594841 },
  { id: "london", name: "London", country: "United Kingdom", flag: "🇬🇧", guys: 12840, photo: 17801374 },
  { id: "berlin", name: "Berlin", country: "Germany", flag: "🇩🇪", guys: 9310, photo: 20723489 },
  { id: "madrid", name: "Madrid", country: "Spain", flag: "🇪🇸", guys: 7420, photo: 30595072 },
  { id: "amsterdam", name: "Amsterdam", country: "Netherlands", flag: "🇳🇱", guys: 5180, photo: 17826697 },
  { id: "nyc", name: "New York", country: "United States", flag: "🇺🇸", guys: 21460, photo: 15141201 },
];

/* ------------------------------- events ------------------------------- */

export type FykEvent = {
  id: string;
  title: string;
  cover: number;
  venuePhoto: number;
  date: string;
  time: string;
  dayLabel: string;
  venue: string;
  address: string;
  city: string;
  hostId: string;
  hostEvents: number;
  capacity: number;
  going: number;
  mutuals: number;
  about: string;
  tags: string[];
  explicitness: Explicitness;
  activityId: string;
  /** Anyone can host anything — casual meets sit alongside big nights. */
  scale: "casual" | "group" | "big";
  cost: string;
};

export const events: FykEvent[] = [
  {
    id: "rooftop-kings",
    title: "Rooftop Kings Mixer",
    cover: 15141201,
    venuePhoto: 17801374,
    date: "Sat, Sep 20",
    time: "9:00 PM",
    dayLabel: "Sat, Sep 20 · 9:00 PM",
    venue: "Sky Lounge, Valletta",
    address: "Triq Sant' Orsla, Valletta VLT 1234, Malta",
    city: "Valletta",
    hostId: "dario",
    hostEvents: 12,
    capacity: 80,
    going: 54,
    mutuals: 3,
    about: "An easy rooftop night for the community — drinks, skyline views, good people.",
    tags: ["Drinks", "Social", "Rooftop", "LGBTQ+", "18+"],
    explicitness: "CLEAN",
    activityId: "drinks",
    scale: "big",
    cost: "Free entry",
  },
  {
    id: "harbour-run",
    title: "Sunrise Harbour Run",
    cover: 30595072,
    venuePhoto: 17594841,
    date: "Sun, Sep 21",
    time: "6:30 AM",
    dayLabel: "Sun, Sep 21 · 6:30 AM",
    venue: "Grand Harbour Promenade",
    address: "Xatt Juan B. Azopardo, Valletta, Malta",
    city: "Valletta",
    hostId: "diego",
    hostEvents: 7,
    capacity: 40,
    going: 22,
    mutuals: 1,
    about: "5K along the water then coffee. All paces welcome — nobody gets left behind.",
    tags: ["Sport", "Morning", "Wellness", "18+"],
    explicitness: "CLEAN",
    activityId: "run",
    scale: "group",
    cost: "Free",
  },
  {
    id: "queer-film",
    title: "Queer Film Club: Restored Classics",
    cover: 19186825,
    venuePhoto: 37117204,
    date: "Thu, Sep 25",
    time: "8:00 PM",
    dayLabel: "Thu, Sep 25 · 8:00 PM",
    venue: "Spazju Kreattiv Cinema",
    address: "St James Cavalier, Valletta, Malta",
    city: "Valletta",
    hostId: "sam",
    hostEvents: 4,
    capacity: 60,
    going: 31,
    mutuals: 2,
    about: "Monthly screening plus a very opinionated discussion afterwards. Snacks provided.",
    tags: ["Film", "Culture", "Social", "18+"],
    explicitness: "CLEAN",
    activityId: "cinema",
    scale: "group",
    cost: "€8",
  },
  {
    id: "bears-brunch",
    title: "Bears & Brunch",
    cover: 6427711,
    venuePhoto: 17801359,
    date: "Sun, Sep 28",
    time: "12:00 PM",
    dayLabel: "Sun, Sep 28 · 12:00 PM",
    venue: "Kingsway Kitchen",
    address: "Triq ir-Repubblika, Valletta, Malta",
    city: "Valletta",
    hostId: "omar",
    hostEvents: 9,
    capacity: 35,
    going: 28,
    mutuals: 4,
    about: "Long table, big plates, zero pretension. Bring a friend or come solo — both work.",
    tags: ["Food", "Bears", "Social", "18+"],
    explicitness: "CLEAN",
    activityId: "brunch",
    scale: "group",
    cost: "Split the bill",
  },
  {
    id: "afterhours",
    title: "Afterhours: Basement Techno",
    cover: 20723489,
    venuePhoto: 27398012,
    date: "Fri, Oct 3",
    time: "11:00 PM",
    dayLabel: "Fri, Oct 3 · 11:00 PM",
    venue: "Vault 12",
    address: "Triq San Gorg, St Julian's, Malta",
    city: "Valletta",
    hostId: "ravi",
    hostEvents: 15,
    capacity: 200,
    going: 143,
    mutuals: 6,
    about: "Dark room, heavy kick, respectful crowd. Consent stewards on the floor all night.",
    tags: ["Nightlife", "Music", "Mature", "18+"],
    explicitness: "MATURE",
    activityId: "club",
    scale: "big",
    cost: "€15",
  },
  {
    id: "newcomers",
    title: "Newcomers Coffee Circle",
    cover: 16166472,
    venuePhoto: 6427715,
    date: "Wed, Oct 8",
    time: "6:30 PM",
    dayLabel: "Wed, Oct 8 · 6:30 PM",
    venue: "Lot Sixty One",
    address: "Triq id-Dejqa, Valletta, Malta",
    city: "Valletta",
    hostId: "adrian",
    hostEvents: 2,
    capacity: 24,
    going: 11,
    mutuals: 0,
    about: "Just moved here? Same. Low-key coffee for people finding their feet in a new city.",
    tags: ["Coffee", "Community", "Newcomers", "18+"],
    explicitness: "CLEAN",
    activityId: "coffee",
    scale: "casual",
    cost: "Buy your own",
  },
  {
    id: "beach-day",
    title: "Golden Bay Beach Day",
    cover: 30595072,
    venuePhoto: 17826697,
    date: "Sat, Sep 20",
    time: "1:00 PM",
    dayLabel: "Sat, Sep 20 · 1:00 PM",
    venue: "Golden Bay, north end",
    address: "Ir-Ramla tal-Mixquqa, Mellieħa, Malta",
    city: "Valletta",
    hostId: "kai",
    hostEvents: 5,
    capacity: 12,
    going: 9,
    mutuals: 2,
    about: "Towels down at the far end past the rocks. Bring water, sun cream and nothing else.",
    tags: ["Beach", "Daytime", "Casual", "18+"],
    explicitness: "CLEAN",
    activityId: "beach",
    scale: "casual",
    cost: "Free",
  },
  {
    id: "fifa-night",
    title: "Controllers & Beers",
    cover: 15141201,
    venuePhoto: 20723489,
    date: "Fri, Sep 19",
    time: "8:00 PM",
    dayLabel: "Fri, Sep 19 · 8:00 PM",
    venue: "Rafael's place, Ħamrun",
    address: "Exact address shared once you RSVP",
    city: "Valletta",
    hostId: "rafael",
    hostEvents: 3,
    capacity: 6,
    going: 4,
    mutuals: 1,
    about: "Two spare controllers, FC and Tekken. Loser buys the next round.",
    tags: ["Gaming", "Indoors", "Small group", "18+"],
    explicitness: "CLEAN",
    activityId: "gaming",
    scale: "casual",
    cost: "Bring a drink",
  },
  {
    id: "valletta-tour",
    title: "The Valletta You Don't Get in Guidebooks",
    cover: 37117204,
    venuePhoto: 17594841,
    date: "Sun, Sep 21",
    time: "10:00 AM",
    dayLabel: "Sun, Sep 21 · 10:00 AM",
    venue: "City Gate, Valletta",
    address: "Triq ir-Repubblika, Valletta, Malta",
    city: "Valletta",
    hostId: "enzo",
    hostEvents: 11,
    capacity: 8,
    going: 6,
    mutuals: 0,
    about: "Three hours on foot with someone who grew up here. Free — I just like showing people around.",
    tags: ["Tour", "Walking", "Newcomers", "18+"],
    explicitness: "CLEAN",
    activityId: "guiding",
    scale: "group",
    cost: "Free",
  },
  {
    id: "padel-doubles",
    title: "Padel Doubles — need two",
    cover: 29981151,
    venuePhoto: 8612474,
    date: "Tue, Sep 23",
    time: "7:00 PM",
    dayLabel: "Tue, Sep 23 · 7:00 PM",
    venue: "Marsa Sports Club",
    address: "Aldo Moro Road, Marsa, Malta",
    city: "Valletta",
    hostId: "diego",
    hostEvents: 7,
    capacity: 4,
    going: 2,
    mutuals: 1,
    about: "Court booked 7–8:30. Two of us, need two more. Any level, we're not good either.",
    tags: ["Sport", "Evening", "Beginners", "18+"],
    explicitness: "CLEAN",
    activityId: "padel",
    scale: "casual",
    cost: "€6 each",
  },
  {
    id: "board-games",
    title: "Board Games & Bad Snacks",
    cover: 16166472,
    venuePhoto: 6427715,
    date: "Wed, Sep 24",
    time: "7:30 PM",
    dayLabel: "Wed, Sep 24 · 7:30 PM",
    venue: "Marginal Books, back room",
    address: "Triq id-Dejqa, Valletta, Malta",
    city: "Valletta",
    hostId: "sam",
    hostEvents: 6,
    capacity: 16,
    going: 11,
    mutuals: 2,
    about: "Catan, Codenames, whatever you bring. Sober-friendly, always has been.",
    tags: ["Games", "Sober", "Indoors", "18+"],
    explicitness: "CLEAN",
    activityId: "boardgames",
    scale: "group",
    cost: "Free",
  },
  {
    id: "sunset-swim",
    title: "Sunset Swim & Chips",
    cover: 17826697,
    venuePhoto: 30595072,
    date: "Thu, Sep 18",
    time: "6:45 PM",
    dayLabel: "Thu, Sep 18 · 6:45 PM",
    venue: "Sliema Front",
    address: "Tower Road, Sliema, Malta",
    city: "Valletta",
    hostId: "noah",
    hostEvents: 2,
    capacity: 10,
    going: 7,
    mutuals: 3,
    about: "Quick dip then chips on the wall. Takes an hour, changes the whole evening.",
    tags: ["Swim", "Evening", "Casual", "18+"],
    explicitness: "CLEAN",
    activityId: "swim",
    scale: "casual",
    cost: "€3 for chips",
  },
  {
    id: "cook-together",
    title: "Sunday Sauce — cook and eat",
    cover: 6427711,
    venuePhoto: 16166472,
    date: "Sun, Sep 28",
    time: "4:00 PM",
    dayLabel: "Sun, Sep 28 · 4:00 PM",
    venue: "Marcus' kitchen, Floriana",
    address: "Shared with confirmed guests",
    city: "Valletta",
    hostId: "marcus",
    hostEvents: 4,
    capacity: 6,
    going: 5,
    mutuals: 2,
    about: "Four hours, one pot, everyone chops something. Vegetarian option always.",
    tags: ["Food", "Small group", "Cooking", "18+"],
    explicitness: "CLEAN",
    activityId: "cook",
    scale: "casual",
    cost: "€10 kitty",
  },
  {
    id: "gear-night",
    title: "Gear Night — Leather & Rubber",
    cover: 20723489,
    venuePhoto: 27398012,
    date: "Sat, Oct 4",
    time: "10:00 PM",
    dayLabel: "Sat, Oct 4 · 10:00 PM",
    venue: "Vault 12, lower floor",
    address: "Triq San Gorg, St Julian's, Malta",
    city: "Valletta",
    hostId: "omar",
    hostEvents: 9,
    capacity: 90,
    going: 61,
    mutuals: 4,
    about: "Dress code enforced at the door. Consent stewards on the floor, house rules posted at entry.",
    tags: ["Kink", "Nightlife", "Dress code", "18+"],
    explicitness: "MATURE",
    activityId: "club",
    scale: "big",
    cost: "€12",
  },
];

/* -------------------------------- chats -------------------------------- */

export type Msg = {
  id: string;
  from: "me" | "them";
  kind?: "text" | "album-request" | "system" | "image" | "voice" | "location";
  body?: string;
  time: string;
  read?: boolean;
  replyTo?: { name: string; body: string };
  albumCount?: number;
  image?: string;
  blur?: string;
  expiresAt?: number;
  editedAt?: number;
  unsent?: boolean;
  sensitive?: boolean;
  audio?: string;
  seconds?: number;
  peaks?: number[];
  sealed?: boolean;
  video?: boolean;
  burnSeconds?: number;
};

export type Thread = {
  id: string;
  personId: string;
  label: string;
  time: string;
  preview: string;
  unread: number;
  matched: boolean;
  group?: boolean;
  messages: Msg[];
};

export const threads: Thread[] = [
  {
    id: "t-theo",
    personId: "theo",
    label: "Theo, 34",
    time: "10:24",
    preview: "Haha thanks — you around this weekend?",
    unread: 1,
    matched: true,
    messages: [
      { id: "m1", from: "them", body: "Hey, love the gym pic 💪", time: "10:08" },
      { id: "m2", from: "me", body: "Thanks! Been trying to get back into a routine lately.", time: "10:12", read: true },
      { id: "m3", from: "them", body: "Haha thanks — you around this weekend?", time: "10:24" },
      {
        id: "m4",
        from: "me",
        body: "Yeah, I'm free Saturday. Want to grab a drink or hit the gym?",
        time: "10:26",
        read: true,
        replyTo: { name: "Theo, 34", body: "Haha thanks — you around this weekend?" },
      },
      { id: "m5", from: "them", kind: "album-request", time: "10:28", albumCount: 5 },
    ],
  },
  {
    id: "t-mateo",
    personId: "mateo",
    label: "Mateo, 29",
    time: "09:12",
    preview: "Sent a photo",
    unread: 1,
    matched: true,
    messages: [
      { id: "m1", from: "them", body: "Morning! That trail you posted looks unreal.", time: "08:54" },
      { id: "m2", from: "me", body: "It's an hour out of town — worth every minute.", time: "09:02", read: true },
      { id: "m3", from: "them", body: "Sent a photo", time: "09:12" },
    ],
  },
  {
    id: "t-dario",
    personId: "dario",
    label: "Dario, 31",
    time: "Yesterday",
    preview: "Let's grab a drink this week?",
    unread: 1,
    matched: true,
    messages: [
      { id: "m1", from: "them", body: "Your rooftop mixer looked great last month.", time: "18:40" },
      { id: "m2", from: "me", body: "Come to the next one — Sep 20.", time: "18:52", read: true },
      { id: "m3", from: "them", body: "Let's grab a drink this week?", time: "19:03" },
    ],
  },
  {
    id: "t-kai",
    personId: "kai",
    label: "Kai, 26",
    time: "Yesterday",
    preview: "You: Sounds good!",
    unread: 0,
    matched: true,
    messages: [
      { id: "m1", from: "them", body: "Session at 7 tomorrow if you're in?", time: "16:20" },
      { id: "m2", from: "me", body: "Sounds good!", time: "16:24", read: true },
    ],
  },
  {
    id: "t-rafael",
    personId: "rafael",
    label: "Rafael, 33",
    time: "Mon",
    preview: "🔥",
    unread: 0,
    matched: true,
    messages: [
      { id: "m1", from: "me", body: "New gloves finally arrived.", time: "12:10", read: true },
      { id: "m2", from: "them", body: "🔥", time: "12:15" },
    ],
  },
  {
    id: "t-noah",
    personId: "noah",
    label: "Noah, 27",
    time: "Mon",
    preview: "You: See you there!",
    unread: 0,
    matched: true,
    messages: [
      { id: "m1", from: "them", body: "Film club Thursday — I RSVP'd.", time: "20:02" },
      { id: "m2", from: "me", body: "See you there!", time: "20:05", read: true },
    ],
  },
  {
    id: "t-luca",
    personId: "luca",
    label: "Luca, 28",
    time: "Sun",
    preview: "Gym tomorrow?",
    unread: 0,
    matched: false,
    messages: [{ id: "m1", from: "them", body: "Gym tomorrow?", time: "21:44" }],
  },
  {
    id: "t-anton",
    personId: "anton",
    label: "Anton, 28",
    time: "Sun",
    preview: "Sent a photo",
    unread: 0,
    matched: false,
    messages: [{ id: "m1", from: "them", body: "Sent a photo", time: "15:30" }],
  },
  {
    id: "t-enzo",
    personId: "enzo",
    label: "Enzo, 32",
    time: "Sat",
    preview: "You: Nice!",
    unread: 0,
    matched: true,
    messages: [
      { id: "m1", from: "them", body: "Rebuilt the whole bike this weekend.", time: "11:02" },
      { id: "m2", from: "me", body: "Nice!", time: "11:20", read: true },
    ],
  },
  {
    id: "t-crew",
    personId: "omar",
    label: "Harbour Crew",
    time: "Fri",
    preview: "Omar: Table booked for 8.",
    unread: 0,
    matched: false,
    group: true,
    messages: [
      { id: "m1", from: "them", body: "Table booked for 8. Don't be late this time.", time: "17:12" },
      { id: "m2", from: "me", body: "I was late once.", time: "17:14", read: true },
    ],
  },
];

export const quickOpeners = [
  "What are you into?",
  "Free tonight?",
  "Into hiking?",
  "Send a photo",
  "Coffee this week?",
  "How's your day going?",
];

/* ------------------------------ me / owner ------------------------------ */

export const me = {
  id: "me",
  name: "Dario",
  age: 31,
  photo: 7510697,
  verified: true,
  city: "Valletta",
  heightCm: 182,
  completion: 82,
  headline: "Profile preview",
  about: "Direct, warm, into rooftop nights and quiet mornings. Looking for something real.",
  tags: [
    { label: "Athletic", tone: "gold" as const },
    { label: "Looking for dating", tone: "violet" as const },
    { label: "Community", tone: "plain" as const },
    { label: "Travel", tone: "plain" as const },
  ],
  cover: 37117204,
  photos: [8554876, 35746676, 29981151, 13003987],
  privateAlbums: [
    { label: "Private", count: 2 },
    { label: "Private", count: 1 },
  ],
  plan: "FREE" as "FREE" | "PLUS",
};

export const attendeeIds = [
  "dario",
  "marcus",
  "jasper",
  "noah",
  "anton",
  "ethan",
  "omar",
  "kai",
  "felix",
  "enzo",
  "luca",
  "ravi",
];

export const notifications = [
  { id: "n1", type: "MATCH", title: "You and Theo matched", body: "Say something — mutual likes fade fast.", time: "2m", unread: true },
  { id: "n2", type: "ALBUM", title: "Theo requested private album access", body: "5 photos · respond from the chat", time: "12m", unread: true },
  { id: "n3", type: "VISIT", title: "3 people viewed your profile", body: "Visible for 24h on the Free plan", time: "1h", unread: true },
  { id: "n4", type: "EVENT", title: "Rooftop Kings Mixer is in 4 days", body: "54 going · 3 mutual matches", time: "5h", unread: false },
  { id: "n5", type: "SYSTEM", title: "Photo verification approved", body: "Reviewed manually by a moderator", time: "Yesterday", unread: false },
];
