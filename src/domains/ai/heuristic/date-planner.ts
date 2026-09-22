/**
 * AI Date & Event Planner — Core AI feature (25.3)
 * From shared wishlist, locations, budget, free-time, proposes 3 concrete plans.
 */

export type DateIdea = {
  title: string;
  venue: string;
  venueType: "coffee" | "bar" | "restaurant" | "park" | "activity" | "cultural";
  time: string; // e.g., "Saturday 3pm"
  duration: string; // e.g., "1-2 hours"
  budget: "free" | "low" | "mid" | "high";
  travelTime: string;
  reservationNeeded: boolean;
  why: string;
  tags: string[];
};

export type DatePlannerInput = {
  userA: { location: { lat: number; lng: number; city: string }; interests: string[]; budget: "free" | "low" | "mid" | "high"; freeSlots: string[] };
  userB: { location: { lat: number; lng: number; city: string }; interests: string[]; budget: "free" | "low" | "mid" | "high"; freeSlots: string[] };
  sharedWishlist: string[];
  groupChat?: { name: string; memberCount: number };
};

const VENUE_DATABASE: Record<string, { name: string; type: DateIdea["venueType"]; budget: DateIdea["budget"]; tags: string[] }[]> = {
  coffee: [
    { name: "Cozy Corner Café", type: "coffee", budget: "low", tags: ["coffee", "casual", "chat"] },
    { name: "Artisan Roasters", type: "coffee", budget: "low", tags: ["coffee", "trendy", "chat"] },
  ],
  bar: [
    { name: "The Golden Hour", type: "bar", budget: "mid", tags: ["drinks", "nightlife", "casual"] },
    { name: "Rooftop Lounge", type: "bar", budget: "high", tags: ["drinks", "views", "romantic"] },
  ],
  park: [
    { name: "Central Park Walk", type: "park", budget: "free", tags: ["outdoors", "casual", "dogs"] },
    { name: "Botanical Gardens", type: "park", budget: "low", tags: ["outdoors", "cultural", "peaceful"] },
  ],
  restaurant: [
    { name: "Little Italy Bistro", type: "restaurant", budget: "mid", tags: ["dining", "romantic", "food"] },
    { name: "Street Food Market", type: "restaurant", budget: "low", tags: ["dining", "casual", "food"] },
  ],
  activity: [
    { name: "Bowling & Beers", type: "activity", budget: "mid", tags: ["gaming", "fun", "casual"] },
    { name: "Museum of Modern Art", type: "cultural", budget: "mid", tags: ["cultural", "art", "chat"] },
  ],
};

export function planDateIdeas(input: DatePlannerInput): DateIdea[] {
  const sharedInterests = input.userA.interests.filter((i) => input.userB.interests.includes(i));
  const allInterests = [...new Set([...input.userA.interests, ...input.userB.interests, ...input.sharedWishlist])];

  const budgetOrder = { free: 0, low: 1, mid: 2, high: 3 };
  const maxBudget = budgetOrder[input.userA.budget] < budgetOrder[input.userB.budget] ? input.userA.budget : input.userB.budget;

  const ideas: DateIdea[] = [];

  // Idea 1: Based on shared interest
  if (sharedInterests.length > 0) {
    const interest = sharedInterests[0];
    const venueType = interestToVenueType(interest);
    const venues = VENUE_DATABASE[venueType] || VENUE_DATABASE.coffee;
    const venue = venues.find((v) => budgetOrder[v.budget] <= budgetOrder[maxBudget]) || venues[0];
    ideas.push({
      title: `${interest} date at ${venue.name}`,
      venue: venue.name,
      venueType: venue.type,
      time: input.userA.freeSlots[0] || "Saturday 3pm",
      duration: "1-2 hours",
      budget: venue.budget,
      travelTime: "~15 min for both",
      reservationNeeded: venue.type === "restaurant" || venue.type === "bar",
      why: `You both like ${interest}, and ${venue.name} is perfect for it — ${venue.tags.join(", ")}`,
      tags: [interest, ...venue.tags],
    });
  }

  // Idea 2: Low-key casual
  ideas.push({
    title: "Coffee & Chat",
    venue: "Cozy Corner Café",
    venueType: "coffee",
    time: input.userA.freeSlots[1] || "Sunday 11am",
    duration: "1 hour",
    budget: "low",
    travelTime: "~10 min",
    reservationNeeded: false,
    why: "Low-pressure, easy to extend if you're vibing, easy to leave if not",
    tags: ["coffee", "casual", "first_date"],
  });

  // Idea 3: Activity-based
  const activityInterest = allInterests.find((i) => ["gaming", "art", "music", "hiking", "gym"].includes(i.toLowerCase())) || "activity";
  ideas.push({
    title: `Fun activity: ${activityInterest}`,
    venue: activityInterest === "hiking" ? "City Park Trail" : "Downtown Arcade",
    venueType: "activity",
    time: input.userA.freeSlots[2] || "Saturday 2pm",
    duration: "2-3 hours",
    budget: maxBudget === "free" ? "free" : "mid",
    travelTime: "~20 min",
    reservationNeeded: false,
    why: `Shared interest in ${activityInterest} makes for natural conversation and shared experience`,
    tags: [activityInterest, "fun", "active"],
  });

  // Group chat variant
  if (input.groupChat) {
    return ideas.map((idea) => ({
      ...idea,
      title: `Group: ${idea.title}`,
      why: `${idea.why} — great for ${input.groupChat!.memberCount} people in ${input.groupChat!.name}`,
    }));
  }

  return ideas.slice(0, 3);
}

function interestToVenueType(interest: string): string {
  const map: Record<string, string> = {
    coffee: "coffee",
    drinks: "bar",
    dining: "restaurant",
    food: "restaurant",
    hiking: "park",
    outdoors: "park",
    gym: "activity",
    gaming: "activity",
    art: "cultural",
    music: "bar",
    travel: "coffee",
  };
  return map[interest.toLowerCase()] || "coffee";
}

export function createEventFromPlan(idea: DateIdea, participants: string[]): {
  title: string;
  venue: string;
  startsAt: string;
  description: string;
  participants: string[];
} {
  return {
    title: idea.title,
    venue: idea.venue,
    startsAt: idea.time,
    description: `${idea.why} — ${idea.duration}, ${idea.budget} budget, ${idea.travelTime}`,
    participants,
  };
}
