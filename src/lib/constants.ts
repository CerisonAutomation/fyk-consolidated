export const TRIBES = ["Bear", "Twink", "Otter", "Jock", "Geek", "Daddy", "Muscle", "Leather", "Chub", "Polar"];
export const TIERS = { free: { name: "Free", price: 0 }, plus: { name: "Plus", price: 9.99 }, gold: { name: "Gold", price: 19.99 }, platinum: { name: "Platinum", price: 29.99 } };
export const TAG_CATEGORIES = { interests: ["Gym", "Music", "Film", "Travel", "Food", "Coffee", "Books", "Art", "Gaming", "Dogs", "Photography", "Hiking"], lifestyle: ["Single", "Open relationship", "Polyamorous", "Monogamous", "Night owl", "Early bird"], physique: ["Slim", "Athletic", "Muscular", "Average", "Large", "Stocky"], kinks: ["Leather", "BDSM", "Roleplay", "Foot", "Pup", "Bondage"] };
export const ACTIVITIES = ["Coffee", "Drinks", "Dinner", "Beach", "Cinema", "Gaming", "Gym", "Hiking", "Karaoke", "Chill", "Hookup", "Date"];

/** Named reaction types matching the Supabase message_reactions table enum. */
export type ReactionName = "heart" | "fire" | "laugh" | "wow" | "like";

/** Unicode emoji shown in the UI picker. */
export const MESSAGE_EMOJIS = ["❤️", "🔥", "😂", "😮", "👍"];

/** Maps the UI unicode emoji to the named type stored in Supabase. */
export const EMOJI_TO_REACTION: Record<string, ReactionName> = {
  "❤️": "heart",
  "🔥": "fire",
  "😂": "laugh",
  "😮": "wow",
  "👍": "like",
};

/** Maps the named Supabase reaction type back to unicode for display. */
export const REACTION_TO_EMOJI: Record<ReactionName, string> = {
  heart: "❤️",
  fire: "🔥",
  laugh: "😂",
  wow: "😮",
  like: "👍",
};

export const ACTIVITY_EMOJIS: Record<string, string> = { Gym: "🏋️", Coffee: "☕", Dinner: "🍽️", Party: "🎉", Movies: "🎬", Walk: "🚶", Travel: "✈️", Other: "📌" };
export const BODY_TYPES = ["Slim", "Athletic", "Muscular", "Average", "Large", "Stocky", "Curvy"];
export const LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Arabic", "Mandarin"];
export const LOOKING_FOR = ["Dating", "Friends", "Relationship", "Hookups", "Right Now", "Networking", "Gym buddy", "Travel buddy"];
export const MEETNOW = ["Gym", "Dinner", "Coffee", "Party", "Movies", "Walk", "Travel", "Other"];
export const POSITIONS = ["Top", "Bottom", "Versatile", "Vers", "Side"];
