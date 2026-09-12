/**
 * Venue guide + interest groups — the ROMEO capabilities Grindr and MACHOBB don't ship.
 * Bundled offline: no external directory API, works with no signal.
 */

export type VenueKind = "Bar" | "Club" | "Café" | "Sauna" | "Community" | "Beach" | "Gym" | "Shop";

export type Venue = {
  id: string;
  name: string;
  kind: VenueKind;
  city: string;
  address: string;
  lat: number;
  lng: number;
  photo: number;
  blurb: string;
  hours: string;
  tags: string[];
  /** Community-sourced context. Deliberately factual, never a safety guarantee. */
  notes: string[];
  checkins: number;
  rating: number;
};

export const VENUES: Venue[] = [
  {
    id: "v-kingsway",
    name: "Kingsway Social",
    kind: "Bar",
    city: "Valletta",
    address: "Triq ir-Repubblika, Valletta",
    lat: 35.8981,
    lng: 14.5142,
    photo: 17801374,
    blurb: "The island's steadiest queer bar. Loud on Fridays, conversational the rest of the week.",
    hours: "Tue–Sun · 18:00–02:00",
    tags: ["Drinks", "Mixed crowd", "Step-free"],
    notes: ["Step-free entrance", "Staff trained on incident reports", "Gender-neutral toilets"],
    checkins: 412,
    rating: 4.6,
  },
  {
    id: "v-vault",
    name: "Vault 12",
    kind: "Club",
    city: "Valletta",
    address: "Triq San Gorg, St Julian's",
    lat: 35.9192,
    lng: 14.4899,
    photo: 20723489,
    blurb: "Basement techno with a consent-steward programme on the floor every night they open.",
    hours: "Fri–Sat · 23:00–06:00",
    tags: ["Techno", "Late", "Darkroom"],
    notes: ["Consent stewards on shift", "Free water at the bar", "Phone-camera policy enforced"],
    checkins: 986,
    rating: 4.4,
  },
  {
    id: "v-lot61",
    name: "Lot Sixty One",
    kind: "Café",
    city: "Valletta",
    address: "Triq id-Dejqa, Valletta",
    lat: 35.8975,
    lng: 14.5119,
    photo: 16166472,
    blurb: "Where the newcomers circle meets. Good for a low-stakes first date in daylight.",
    hours: "Daily · 07:30–19:00",
    tags: ["Coffee", "Daytime", "First dates"],
    notes: ["Busy and well-lit", "Easy exit onto a main street", "Outdoor seating"],
    checkins: 233,
    rating: 4.8,
  },
  {
    id: "v-thermae",
    name: "Thermae Men's Spa",
    kind: "Sauna",
    city: "Valletta",
    address: "Triq Sant' Anna, Floriana",
    lat: 35.8935,
    lng: 14.5058,
    photo: 8612474,
    blurb: "Members-only spa. Clear posted house rules and free testing clinics twice a month.",
    hours: "Daily · 14:00–00:00",
    tags: ["Adults only", "Sauna", "Health clinic"],
    notes: ["Posted consent policy", "Free condoms and lube", "Monthly sexual-health clinic"],
    checkins: 517,
    rating: 4.2,
  },
  {
    id: "v-mgrm",
    name: "MGRM Community Centre",
    kind: "Community",
    city: "Valletta",
    address: "Triq San Pawl, Valletta",
    lat: 35.8996,
    lng: 14.5131,
    photo: 15141201,
    blurb: "Rights movement drop-in: counselling, legal advice, peer groups and a very good library.",
    hours: "Mon–Fri · 09:00–17:00",
    tags: ["Support", "Free", "Counselling"],
    notes: ["Free confidential counselling", "Legal clinic on Wednesdays", "Trans peer group monthly"],
    checkins: 148,
    rating: 4.9,
  },
  {
    id: "v-golden",
    name: "Golden Bay Cove",
    kind: "Beach",
    city: "Naxxar",
    address: "Ir-Ramla tal-Mixquqa, Mellieħa",
    lat: 35.9375,
    lng: 14.3441,
    photo: 30595072,
    blurb: "The unofficial queer stretch is the far northern end, past the rocks. Busiest in July.",
    hours: "Daylight hours",
    tags: ["Beach", "Summer", "Cruisy"],
    notes: ["No lifeguard past the rocks", "Bring water — no kiosk at that end", "Steep path down"],
    checkins: 674,
    rating: 4.3,
  },
  {
    id: "v-forge",
    name: "The Forge Strength Club",
    kind: "Gym",
    city: "Valletta",
    address: "Triq il-Mall, Floriana",
    lat: 35.8944,
    lng: 14.5072,
    photo: 29981151,
    blurb: "Independent gym with an explicit anti-harassment policy and a queer lifting group on Sundays.",
    hours: "Mon–Sun · 06:00–22:00",
    tags: ["Fitness", "Inclusive", "Group"],
    notes: ["Written anti-harassment policy", "Private changing cubicles", "Sunday queer lifting group"],
    checkins: 305,
    rating: 4.7,
  },
  {
    id: "v-bookshop",
    name: "Marginal Books",
    kind: "Shop",
    city: "Valletta",
    address: "Triq id-Dejqa, Valletta",
    lat: 35.8969,
    lng: 14.5124,
    photo: 19186825,
    blurb: "Independent bookshop with the island's best queer literature shelf and a reading night monthly.",
    hours: "Tue–Sat · 10:00–18:30",
    tags: ["Books", "Quiet", "Events"],
    notes: ["Monthly reading night", "Noticeboard for community events", "Step at the entrance"],
    checkins: 91,
    rating: 4.8,
  },
];

export type Club = {
  id: string;
  name: string;
  emoji: string;
  members: number;
  city: string;
  blurb: string;
  tags: string[];
  cadence: string;
  open: boolean;
};

export const CLUBS: Club[] = [
  {
    id: "c-runners",
    name: "Harbour Runners",
    emoji: "🏃",
    members: 184,
    city: "Valletta",
    blurb: "5K along the water three mornings a week. Every pace, nobody dropped.",
    tags: ["Sport", "Morning", "All levels"],
    cadence: "Mon · Wed · Sun, 06:30",
    open: true,
  },
  {
    id: "c-film",
    name: "Queer Film Club",
    emoji: "🎬",
    members: 312,
    city: "Valletta",
    blurb: "Monthly restored classic plus a very opinionated argument afterwards.",
    tags: ["Film", "Culture", "Monthly"],
    cadence: "Last Thursday, 20:00",
    open: true,
  },
  {
    id: "c-newcomers",
    name: "New in Malta",
    emoji: "🧭",
    members: 268,
    city: "Valletta",
    blurb: "Just moved here? Practical advice on doctors, landlords and where to actually go out.",
    tags: ["Newcomers", "Support", "Weekly"],
    cadence: "Wednesdays, 18:30",
    open: true,
  },
  {
    id: "c-bears",
    name: "Mediterranean Bears",
    emoji: "🐻",
    members: 441,
    city: "Valletta",
    blurb: "Long tables, big plates, zero pretension. Brunches, hikes and the occasional boat day.",
    tags: ["Bears", "Social", "Food"],
    cadence: "Fortnightly Sundays",
    open: true,
  },
  {
    id: "c-leather",
    name: "Malta Leather & Gear",
    emoji: "🖤",
    members: 156,
    city: "Valletta",
    blurb: "Gear nights, munches and a workshop programme. Consent education is the price of entry.",
    tags: ["Leather", "Kink", "18+"],
    cadence: "First Saturday",
    open: false,
  },
  {
    id: "c-sober",
    name: "Sober & Social",
    emoji: "☕",
    members: 97,
    city: "Valletta",
    blurb: "Everything the scene does, minus the alcohol. Coffee, hikes, cinema, board games.",
    tags: ["Sober", "Wellness", "Weekly"],
    cadence: "Saturdays, 11:00",
    open: true,
  },
  {
    id: "c-trans",
    name: "Trans & Non-binary Circle",
    emoji: "🏳️‍⚧️",
    members: 128,
    city: "Valletta",
    blurb: "Peer-led, closed group. Members-only space with a vetting conversation before joining.",
    tags: ["Trans", "Peer support", "Closed"],
    cadence: "Second Tuesday",
    open: false,
  },
  {
    id: "c-tech",
    name: "Queer Tech Malta",
    emoji: "💻",
    members: 203,
    city: "Valletta",
    blurb: "Networking that isn't grim. Talks, job leads and mentoring for people early in their careers.",
    tags: ["Networking", "Career", "Monthly"],
    cadence: "Third Wednesday",
    open: true,
  },
];

/** ROMEO-style footprints — compliments only. No body ranking, no scoring people. */
export const FOOTPRINTS = [
  { id: "smile", emoji: "😄", label: "Great smile" },
  { id: "style", emoji: "🧥", label: "Great style" },
  { id: "funny", emoji: "😂", label: "Made me laugh" },
  { id: "cuddly", emoji: "🫂", label: "So cuddly" },
  { id: "clever", emoji: "🧠", label: "Clever" },
  { id: "kind", emoji: "💛", label: "Seems kind" },
  { id: "eyes", emoji: "👀", label: "Those eyes" },
  { id: "beard", emoji: "🧔", label: "Beard goals" },
  { id: "fit", emoji: "💪", label: "Serious dedication" },
  { id: "adventurous", emoji: "🧗", label: "Adventurous" },
  { id: "goodtaste", emoji: "🎧", label: "Good taste" },
  { id: "welcome", emoji: "👋", label: "Welcome here" },
];

export const MANNERS = [
  { id: "friendly", label: "Friendly", hint: "Here to chat and see what happens." },
  { id: "flirty", label: "Flirty", hint: "Playful, but reading the room." },
  { id: "direct", label: "Direct", hint: "I'll say what I want, you do the same." },
  { id: "slow", label: "Slow burn", hint: "I like a conversation before anything else." },
  { id: "romantic", label: "Romantic", hint: "Looking for something that lasts." },
];

export const DEFAULT_PHRASES = [
  "Hey — what's your evening looking like?",
  "That photo at the harbour is great, where was it?",
  "I'm around this week if you fancy a coffee.",
  "Fair warning: I will talk about my dog.",
  "What are you into?",
  "Free tonight?",
];

/** Health fields. Opt-in, factual, never filterable by anyone else. */
export const HEALTH_FIELDS = [
  { id: "prep", label: "On PrEP", hint: "Shown only if you switch it on." },
  { id: "tested", label: "Last tested", hint: "A date you set yourself, no verification implied." },
  { id: "vaccinated", label: "Mpox & HepB vaccinated", hint: "Self-reported." },
  { id: "undetectable", label: "Undetectable = untransmittable", hint: "U=U. Shown as a fact, never as a warning." },
];
