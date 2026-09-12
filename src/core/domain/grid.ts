export const GRID_CONSTANTS = {
  positions: ["Top", "Bottom", "Versatile", "Vers", "Side"],
  tribes: ["Bear", "Twink", "Otter", "Jock", "Geek", "Daddy", "Muscle", "Leather", "Chub", "Polar", "Wolf", "Cub", "Silver", "Rugged", "Discreet"],
  bodyTypes: ["Slim", "Athletic", "Muscular", "Average", "Large", "Stocky", "Curvy"],
  lookingFor: ["Dating", "Friends", "Relationship", "Hookups", "Right Now", "Networking", "Gym buddy", "Travel buddy"],
  languages: ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Arabic", "Mandarin", "Dutch", "Japanese"],
  activities: ["Coffee", "Drinks", "Dinner", "Beach", "Cinema", "Gaming", "Gym", "Hiking", "Karaoke", "Chill", "Hookup", "Date", "Travel", "Cooking", "Art", "Music"],
  sortOptions: ["distance", "recent", "compatibility", "new"] as const,
  meetnowCategories: ["Gym", "Dinner", "Coffee", "Party", "Movies", "Walk", "Travel", "Other"],
  eventCategories: ["Party", "Fitness", "Culture", "Social", "Networking", "Outdoor", "Food"],
  messageEmojis: ["❤️", "🔥", "😂", "😮", "👍"],
  bodyTypeEmoji: { Slim: "🏃", Athletic: "💪", Muscular: "🏋️", Average: "👤", Large: "🐻", Stocky: "🧱", Curvy: "✨" },
  positionEmoji: { Top: "⬆️", Bottom: "⬇️", Versatile: "↕️", Vers: "↕️", Side: "↔️" },
} as const;

export type SortOption = typeof GRID_CONSTANTS.sortOptions[number];

export interface GridFilter {
  tribes: string[];
  lookingFor: string[];
  bodyType: string[];
  intent: string[];
  ageRange: [number, number];
  maxDistance: number;
  minMatchScore: number;
  onlineOnly: boolean;
  verifiedOnly: boolean;
  sort: SortOption;
}

export const GRID_FILTER_DEFAULTS: GridFilter = {
  tribes: [],
  lookingFor: [],
  bodyType: [],
  intent: [],
  ageRange: [18, 70],
  maxDistance: 50,
  minMatchScore: 0,
  onlineOnly: false,
  verifiedOnly: false,
  sort: "distance",
};

export function isFilterActive(filter: GridFilter): boolean {
  return (
    filter.tribes.length > 0 ||
    filter.lookingFor.length > 0 ||
    filter.bodyType.length > 0 ||
    filter.intent.length > 0 ||
    filter.ageRange[0] !== 18 ||
    filter.ageRange[1] !== 70 ||
    filter.maxDistance !== 50 ||
    filter.minMatchScore !== 0 ||
    filter.onlineOnly ||
    filter.verifiedOnly ||
    filter.sort !== "distance"
  );
}

export function activeFilterCount(filter: GridFilter): number {
  let count = 0;
  if (filter.tribes.length) count++;
  if (filter.lookingFor.length) count++;
  if (filter.bodyType.length) count++;
  if (filter.intent.length) count++;
  if (filter.ageRange[0] !== 18 || filter.ageRange[1] !== 70) count++;
  if (filter.maxDistance !== 50) count++;
  if (filter.minMatchScore !== 0) count++;
  if (filter.onlineOnly) count++;
  if (filter.verifiedOnly) count++;
  return count;
}
