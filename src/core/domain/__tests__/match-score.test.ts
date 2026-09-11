import { describe, expect, it } from "vitest";
import {
  computeMatchScore,
  type MatchUser,
} from "../../../domains/ai/heuristic/match-score";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<MatchUser> = {}): MatchUser {
  return {
    interests: [],
    goals: [],
    lookingFor: [],
    grindrTribes: [],
    bodyType: null,
    sexualPosition: null,
    age: null,
    aboutMe: "",
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("computeMatchScore", () => {
  describe("identical profiles should score high", () => {
    it("scores two identical users above 80", () => {
      const user = makeUser({
        interests: ["gym", "music", "travel"],
        goals: ["relationship", "friends"],
        lookingFor: [1, 2],
        grindrTribes: [3, 5],
        bodyType: 2,
        sexualPosition: 1,
        age: 28,
        aboutMe: "I love fitness and live music. Where should we travel next?",
      });

      const result = computeMatchScore(user, { ...user });

      expect(result.overall).toBeGreaterThanOrEqual(80);
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it("generates positive reasons for identical profiles", () => {
      const user = makeUser({
        interests: ["gym", "cooking", "music"],
        goals: ["relationship"],
        lookingFor: [1],
        grindrTribes: [3],
        sexualPosition: 1,
        age: 25,
        aboutMe: "I love the gym and cooking delicious meals. Music is life. Do you enjoy working out?",
      });

      const result = computeMatchScore(user, { ...user });

      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.some((r) => r.includes("interest"))).toBe(true);
    });
  });

  describe("completely different profiles should score low", () => {
    it("scores opposing interests below 50", () => {
      const userA = makeUser({
        interests: ["gym", "sports", "running"],
        goals: ["relationship", "marriage"],
        lookingFor: [1],
        grindrTribes: [1],
        age: 22,
        aboutMe: "Fitness enthusiast. Love the gym and outdoor sports.",
      });

      const userB = makeUser({
        interests: ["reading", "art", "movies"],
        goals: ["hookups"],
        lookingFor: [3],
        grindrTribes: [8],
        age: 45,
        aboutMe: "I prefer quiet evenings with a good book and some art.",
      });

      const result = computeMatchScore(userA, userB);

      expect(result.overall).toBeLessThanOrEqual(50);
    });

    it("scores users with no overlapping goals near 0 for goals dimension", () => {
      const userA = makeUser({ goals: ["relationship"] });
      const userB = makeUser({ goals: ["hookups"] });

      const result = computeMatchScore(userA, userB);

      expect(result.dimensions.goals).toBe(0);
    });
  });

  describe("dimension weights are applied correctly", () => {
    it("interests dimension (28%) has highest weight", () => {
      const user = makeUser({
        interests: ["gym", "music", "travel", "cooking", "gaming"],
        goals: [],
        aboutMe: "Hey there!",
      });
      const target = makeUser({
        interests: ["gym", "music", "travel", "cooking", "gaming"],
        goals: [],
        aboutMe: "Hey there!",
      });

      const result = computeMatchScore(user, target);

      // With identical interests, the interests dimension should be 100
      expect(result.dimensions.interests).toBe(100);

      // The overall score must reflect the 28% weight of interests
      const expected =
        100 * 0.28 +
        result.dimensions.goals * 0.24 +
        result.dimensions.chemistry * 0.20 +
        result.dimensions.lifestyle * 0.14 +
        result.dimensions.communication * 0.14;

      expect(result.overall).toBe(Math.round(expected));
    });

    it("returns all five dimension keys", () => {
      const result = computeMatchScore(makeUser(), makeUser());

      const dims = Object.keys(result.dimensions);
      expect(dims).toContain("interests");
      expect(dims).toContain("goals");
      expect(dims).toContain("chemistry");
      expect(dims).toContain("lifestyle");
      expect(dims).toContain("communication");
    });

    it("all dimension scores are between 0 and 100", () => {
      const result = computeMatchScore(makeUser(), makeUser());

      for (const dim of Object.values(result.dimensions)) {
        expect(dim).toBeGreaterThanOrEqual(0);
        expect(dim).toBeLessThanOrEqual(100);
      }
    });

    it("overall is always between 0 and 100", () => {
      const profiles = [
        makeUser({ interests: ["gym"] }),
        makeUser({ interests: ["reading", "art"], age: 50 }),
        makeUser({ aboutMe: "Hi" }),
        makeUser({ goals: ["relationship"], lookingFor: [1] }),
      ];

      for (const userA of profiles) {
        for (const userB of profiles) {
          const result = computeMatchScore(userA, userB);
          expect(result.overall).toBeGreaterThanOrEqual(0);
          expect(result.overall).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe("vibe inference", () => {
    it("returns Athletic vibe for gym-focused profile", () => {
      const user = makeUser({
        interests: ["gym", "fitness"],
        aboutMe: "Muscular guy who lives in the gym",
      });

      const result = computeMatchScore(user, makeUser());

      expect(result.vibe).toBe("Athletic");
    });

    it("returns Nerdy vibe for tech-focused profile", () => {
      const user = makeUser({
        interests: ["tech", "gaming"],
        aboutMe: "Software developer who loves anime and gaming",
      });

      const result = computeMatchScore(user, makeUser());

      expect(result.vibe).toBe("Nerdy");
    });

    it("returns Creative vibe for art-focused profile", () => {
      const user = makeUser({
        interests: ["art", "music"],
        aboutMe: "Artist and musician. Design is my passion.",
      });

      const result = computeMatchScore(user, makeUser());

      expect(result.vibe).toBe("Creative");
    });
  });

  describe("chemistry dimension", () => {
    it("adds 25 points for compatible sexual positions", () => {
      const userA = makeUser({ sexualPosition: 1 }); // top
      const userB = makeUser({ sexualPosition: 2 }); // bottom

      const result = computeMatchScore(userA, userB);

      expect(result.dimensions.chemistry).toBeGreaterThanOrEqual(65);
    });

    it("subtracts 10 points for incompatible positions", () => {
      const userA = makeUser({ sexualPosition: 1 }); // top
      const userB = makeUser({ sexualPosition: 1 }); // top

      const result = computeMatchScore(userA, userB);

      expect(result.dimensions.chemistry).toBeLessThanOrEqual(45);
    });
  });

  describe("reasons generation", () => {
    it("adds 'Strong shared interests' when interests >= 70", () => {
      const user = makeUser({
        interests: ["gym", "music", "travel", "cooking"],
      });

      const result = computeMatchScore(user, { ...user });

      expect(result.reasons).toContain("Strong shared interests");
    });

    it("adds 'Different interests' when interests < 30", () => {
      const userA = makeUser({ interests: ["gym"] });
      const userB = makeUser({ interests: ["reading"] });

      const result = computeMatchScore(userA, userB);

      expect(result.reasons).toContain("Different interests");
    });
  });
});
