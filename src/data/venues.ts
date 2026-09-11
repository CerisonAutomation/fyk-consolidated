// ═══════════════════════════════════════════════════════════════════════════════
// Curated Venue Guide — Malta & surrounding areas
// ═══════════════════════════════════════════════════════════════════════════════

export type VenueCategory =
  | "bar"
  | "restaurant"
  | "gym"
  | "cafe"
  | "club"
  | "outdoor"
  | "culture"
  | "beach";

export interface Venue {
  id: string;
  name: string;
  category: VenueCategory;
  address: string;
  city: string;
  lat: number;
  lng: number;
  hours: string;
  description: string;
  photos: string[];
  tags: string[];
  rating: number;
  priceLevel: "$" | "$$" | "$$$";
  website?: string;
}

export const VENUE_CATEGORIES: Record<VenueCategory, { label: string; emoji: string }> = {
  bar: { label: "Bars", emoji: "🍸" },
  restaurant: { label: "Restaurants", emoji: "🍽️" },
  gym: { label: "Gyms", emoji: "🏋️" },
  cafe: { label: "Cafes", emoji: "☕" },
  club: { label: "Clubs", emoji: "🎵" },
  outdoor: { label: "Outdoors", emoji: "🌳" },
  culture: { label: "Culture", emoji: "🎨" },
  beach: { label: "Beaches", emoji: "🏖️" },
};

export const CURATED_VENUES: Venue[] = [
  // ── Bars ──────────────────────────────────────────────────────────────
  {
    id: "v-1",
    name: "Cafe Society",
    category: "bar",
    address: "53 Strait Street",
    city: "Valletta",
    lat: 35.8995,
    lng: 14.5146,
    hours: "Mon–Sat 18:00–02:00",
    description:
      "A Valletta institution. Cocktails, wine, and a crowd that knows what it wants. Strait Street's oldest gay-friendly bar.",
    photos: [],
    tags: ["cocktails", "lgbtq-friendly", "late-night"],
    rating: 4.6,
    priceLevel: "$$",
  },
  {
    id: "v-2",
    name: "The#echo Bar",
    category: "bar",
    address: "120 Merchants Street",
    city: "Valletta",
    lat: 35.8991,
    lng: 14.5153,
    hours: "Wed–Sat 20:00–03:00",
    description:
      "Rooftop cocktails with harbour views. DJ sets on weekends. The place to see and be seen.",
    photos: [],
    tags: ["rooftop", "dj", "views"],
    rating: 4.4,
    priceLevel: "$$",
  },
  {
    id: "v-3",
    name: "HUGO'S Terrace",
    category: "bar",
    address: "Hugo's Hotel, St Julians",
    city: "St Julians",
    lat: 35.9188,
    lng: 14.4892,
    hours: "Daily 17:00–01:00",
    description:
      "Upscale terrace bar at Hugo's Hotel. Craft cocktails, smart-casual crowd, poolside vibes in summer.",
    photos: [],
    tags: ["terrace", "craft-cocktails", "hotel"],
    rating: 4.3,
    priceLevel: "$$$",
  },

  // ── Restaurants ───────────────────────────────────────────────────────
  {
    id: "v-4",
    name: "Legligin",
    category: "restaurant",
    address: "10 Santa Maria Street",
    city: "Valletta",
    lat: 35.8992,
    lng: 14.5139,
    hours: "Tue–Sun 12:00–23:00",
    description:
      "Sharing plates, local wine, and a relaxed atmosphere. Perfect for group dinners. Maltese-meets-Mediterranean.",
    photos: [],
    tags: ["sharing-plates", "wine", "group-friendly"],
    rating: 4.7,
    priceLevel: "$$",
  },
  {
    id: "v-5",
    name: "Noni",
    category: "restaurant",
    address: "217 Republic Street",
    city: "Valletta",
    lat: 35.9001,
    lng: 14.5151,
    hours: "Tue–Sat 19:00–23:00",
    description:
      "Modern Maltese tasting menu. Intimate 30-seat dining room. Book ahead — this one fills fast.",
    photos: [],
    tags: ["fine-dining", "tasting-menu", "intimate"],
    rating: 4.8,
    priceLevel: "$$$",
  },
  {
    id: "v-6",
    name: "Tarragon",
    category: "restaurant",
    address: "Triq ir-Rabat",
    city: "Mdina",
    lat: 35.8861,
    lng: 14.4035,
    hours: "Daily 12:00–22:30",
    description:
      "Dining inside the walls of the Silent City. Mediterranean cuisine, candlelit courtyard seating.",
    photos: [],
    tags: ["historic", "courtyard", "romantic"],
    rating: 4.5,
    priceLevel: "$$$",
  },

  // ── Gyms ──────────────────────────────────────────────────────────────
  {
    id: "v-7",
    name: "Bodycraft Gym",
    category: "gym",
    address: "221 Triq Sant'Anna",
    city: "St Julians",
    lat: 35.9185,
    lng: 14.4873,
    hours: "Mon–Fri 06:00–22:00, Sat–Sun 08:00–20:00",
    description:
      "Well-equipped gym with free weights, machines, and a functional training zone. Popular with the community.",
    photos: [],
    tags: ["weights", "functional", "personal-training"],
    rating: 4.3,
    priceLevel: "$$",
  },
  {
    id: "v-8",
    name: "Six Pack Gym",
    category: "gym",
    address: "140 already Road",
    city: "Birkirkara",
    lat: 35.8917,
    lng: 14.4642,
    hours: "Mon–Sat 06:00–23:00",
    description:
      "Hardcore training facility. Powerlifting platform, strongman equipment, and a no-nonsense community.",
    photos: [],
    tags: ["powerlifting", "strongman", "hardcore"],
    rating: 4.2,
    priceLevel: "$",
  },

  // ── Cafes ─────────────────────────────────────────────────────────────
  {
    id: "v-9",
    name: "Cafe Cordina",
    category: "cafe",
    address: "244 Republic Street",
    city: "Valletta",
    lat: 35.9003,
    lng: 14.5148,
    hours: "Daily 07:30–21:00",
    description:
      "Malta's most iconic cafe. Pastries, coffee, and people-watching on Republic Street since 1837.",
    photos: [],
    tags: ["historic", "pastries", "people-watching"],
    rating: 4.4,
    priceLevel: "$",
  },
  {
    id: "v-10",
    name: "Coffee Circus",
    category: "cafe",
    address: "18 Old Bakery Street",
    city: "Valletta",
    lat: 35.8997,
    lng: 14.5132,
    hours: "Mon–Sat 08:00–18:00",
    description:
      "Specialty coffee, homemade brunch, and a laid-back courtyard. The kind of place where conversations last for hours.",
    photos: [],
    tags: ["specialty-coffee", "brunch", "courtyard"],
    rating: 4.6,
    priceLevel: "$",
  },

  // ── Clubs ─────────────────────────────────────────────────────────────
  {
    id: "v-11",
    name: "FREYJ",
    category: "club",
    address: "St George's Road",
    city: "Paceville",
    lat: 35.9284,
    lng: 14.4793,
    hours: "Thu–Sat 22:00–04:00",
    description:
      "The main event space. DJ nights, themed parties, and the occasional live performance. FYK hosts events here regularly.",
    photos: [],
    tags: ["dj-nights", "themed-parties", "dance-floor"],
    rating: 4.1,
    priceLevel: "$$",
  },
  {
    id: "v-12",
    name: "Therapy",
    category: "club",
    address: "26 Triq id-Duluri",
    city: "Paceville",
    lat: 35.9278,
    lng: 14.4801,
    hours: "Fri–Sat 22:00–05:00",
    description:
      "House and techno in a basement venue. Sound system is serious. The crowd is selective.",
    photos: [],
    tags: ["house", "techno", "underground"],
    rating: 4.0,
    priceLevel: "$$",
  },

  // ── Outdoor ───────────────────────────────────────────────────────────
  {
    id: "v-13",
    name: "Upper Barrakka Gardens",
    category: "outdoor",
    address: "St Publius Street",
    city: "Valletta",
    lat: 35.8958,
    lng: 14.5119,
    hours: "Daily 07:00–22:00",
    description:
      "Panoramic views of the Grand Harbour. The noon cannon ceremony is a must. Great for a sunset hang.",
    photos: [],
    tags: ["harbour-views", "gardens", "sunset"],
    rating: 4.7,
    priceLevel: "$",
  },
  {
    id: "v-14",
    name: "Sliema Promenade",
    category: "outdoor",
    address: "Tower Road",
    city: "Sliema",
    lat: 35.9122,
    lng: 14.5068,
    hours: "Always open",
    description:
      "The promenade walk from Sliema to St Julians. Runs, sunset drinks, or just soaking up the sea air.",
    photos: [],
    tags: ["promenade", "running", "sunset"],
    rating: 4.5,
    priceLevel: "$",
  },

  // ── Culture ───────────────────────────────────────────────────────────
  {
    id: "v-15",
    name: "Spazju Kreattiv",
    category: "culture",
    address: "St James Cavalier, Castille Place",
    city: "Valletta",
    lat: 35.8987,
    lng: 14.5140,
    hours: "Mon–Sat 10:00–20:00",
    description:
      "National centre for creativity. Film screenings, art exhibitions, live theatre. Always something on.",
    photos: [],
    tags: ["exhibitions", "film", "theatre"],
    rating: 4.4,
    priceLevel: "$",
  },

  // ── Beach ─────────────────────────────────────────────────────────────
  {
    id: "v-16",
    name: "Ghajn Tuffieha Bay",
    category: "beach",
    address: "Ghajn Tuffieha",
    city: "Mgarr",
    lat: 35.9292,
    lng: 14.3492,
    hours: "Always open",
    description:
      "Red-sand beach backed by clay cliffs. A bit of a trek down but worth every step. Quieter than Golden Bay.",
    photos: [],
    tags: ["red-sand", "cliffs", "quiet"],
    rating: 4.6,
    priceLevel: "$",
  },
  {
    id: "v-17",
    name: "Paradise Bay",
    category: "beach",
    address: "Cirkewwa",
    city: "Mellieha",
    lat: 35.9889,
    lng: 14.3342,
    hours: "Always open",
    description:
      "Crystal-clear water, great for snorkelling. Small and sheltered. Gets busy in summer mornings.",
    photos: [],
    tags: ["snorkelling", "crystal-clear", "sheltered"],
    rating: 4.3,
    priceLevel: "$",
  },
];
