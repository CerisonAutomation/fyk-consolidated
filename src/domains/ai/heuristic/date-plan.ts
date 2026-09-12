/**
 * date-plan.ts
 * Budget-tiered date ideas (free/low/mid/high, 3 each) + interest additions.
 */

export type BudgetTier = "free" | "low" | "mid" | "high";

export interface DatePlan {
  tier: BudgetTier;
  idea: string;
  interestAddition?: string;
}

const IDEAS: Record<BudgetTier, string[]> = {
  free: [
    "Walk through the park and grab ice cream",
    "Visit a free museum or art gallery",
    "Watch the sunset at a scenic spot",
  ],
  low: [
    "Coffee at a cozy cafe and people-watch",
    "Browse a bookstore and share picks",
    "Visit a farmer's market and sample everything",
  ],
  mid: [
    "Dinner at a nice restaurant with a good vibe",
    "Cook a meal together at home",
    "Catch a movie followed by dessert",
  ],
  high: [
    "Rooftop bar with cocktails and city views",
    "Fine dining experience with wine pairing",
    "Weekend getaway to a nearby town",
  ],
};

const INTEREST_ADDITIONS: Record<string, string[]> = {
  gym: [" -- warm up with a quick workout first"],
  music: [" -- find a venue with live music"],
  art: [" -- stop by a local gallery opening"],
  travel: [" -- pick a neighborhood you've never explored"],
  cooking: [" -- take a cooking class together"],
  gaming: [" -- hit up an arcade bar"],
  reading: [" -- find a bookstore cafe to browse"],
  movies: [" -- catch an indie film at an arthouse cinema"],
  hiking: [" -- start with a short trail then grab lunch"],
  tech: [" -- visit a tech museum or maker space"],
  yoga: [" -- do a couples yoga session first"],
  dance: [" -- end the night at a dance spot"],
  fashion: [" -- window shop and rate outfits"],
  sports: [" -- catch a local game together"],
};

function getInterestAddition(interests: string[]): string | undefined {
  for (const interest of interests) {
    const lower = interest.toLowerCase().trim();
    const addition = INTEREST_ADDITIONS[lower];
    if (addition) return addition[0];
  }
  return undefined;
}

export function planDate(
  interests: string[],
  budget: BudgetTier,
): DatePlan[] {
  const ideas = IDEAS[budget] ?? IDEAS.mid;
  const addition = getInterestAddition(interests);

  return ideas.map((idea) => ({
    tier: budget,
    idea,
    interestAddition: addition,
  }));
}
