/**
 * profile-analyze.ts
 * 6-check profile scoring:
 *   photos (22pts), bio (22pts), interests (16pts), tribes (12pts),
 *   looking_for (12pts), verification (16pts)
 * Total: 100pts
 */

export interface ProfileUser {
  medias?: Array<{ state: number; type: number }>;
  aboutMe?: string | null;
  interests?: string[];
  grindrTribes?: number[];
  lookingFor?: number[];
  verifiedInstagramId?: string | null;
  showVipBadge?: boolean;
  isVerified?: boolean;
  displayName?: string | null;
  height?: number | null;
  weight?: number | null;
  age?: number | null;
}

export interface ProfileAnalysis {
  score: number;
  strengths: string[];
  gaps: string[];
  tips: string[];
}

function scorePhotos(user: ProfileUser): { pts: number; notes: string[] } {
  const notes: string[] = [];
  const mediaCount = user.medias?.length ?? 0;

  if (mediaCount === 0) return { pts: 0, notes: ["No photos uploaded"] };

  let pts = 0;
  if (mediaCount >= 1) pts += 8;
  if (mediaCount >= 2) pts += 4;
  if (mediaCount >= 3) pts += 4;
  if (mediaCount >= 4) pts += 3;
  if (mediaCount >= 5) pts += 3;

  if (mediaCount >= 4) notes.push(`${mediaCount} photos uploaded`);
  else if (mediaCount >= 2) notes.push(`Only ${mediaCount} photos -- add more`);
  else notes.push("Only 1 photo -- add at least 3");

  return { pts: Math.min(22, pts), notes };
}

function scoreBio(user: ProfileUser): { pts: number; notes: string[] } {
  const notes: string[] = [];
  const bio = user.aboutMe?.trim() ?? "";

  if (bio.length === 0) return { pts: 0, notes: ["No bio written"] };

  let pts = 0;
  const wordCount = bio.split(/\s+/).length;

  if (wordCount >= 10) pts += 6;
  if (wordCount >= 20) pts += 4;
  if (wordCount >= 40) pts += 4;
  if (wordCount >= 80) pts += 4;
  if (wordCount < 10) pts += 2;

  if (bio.includes("?")) pts += 2;
  if (bio.includes("!")) pts += 1;
  if (/[A-Z]/.test(bio[0] ?? "")) pts += 1;

  if (wordCount >= 30) notes.push("Good bio length");
  else if (wordCount >= 10) notes.push("Bio could be longer");
  else notes.push("Bio is too short");

  if (bio.includes("?")) notes.push("Bio invites conversation");

  return { pts: Math.min(22, pts), notes };
}

function scoreInterests(user: ProfileUser): { pts: number; notes: string[] } {
  const notes: string[] = [];
  const interests = user.interests ?? [];

  if (interests.length === 0) return { pts: 0, notes: ["No interests listed"] };

  let pts = 0;
  if (interests.length >= 1) pts += 4;
  if (interests.length >= 3) pts += 4;
  if (interests.length >= 5) pts += 4;
  if (interests.length >= 8) pts += 4;

  if (interests.length >= 5) notes.push(`${interests.length} interests listed`);
  else notes.push("Add more interests for better matching");

  return { pts: Math.min(16, pts), notes };
}

function scoreTribes(user: ProfileUser): { pts: number; notes: string[] } {
  const notes: string[] = [];
  const tribes = user.grindrTribes ?? [];

  if (tribes.length === 0) return { pts: 0, notes: ["No tribe selected"] };

  let pts = 0;
  if (tribes.length >= 1) pts += 6;
  if (tribes.length >= 2) pts += 6;

  notes.push(`${tribes.length} tribe${tribes.length > 1 ? "s" : ""} selected`);

  return { pts: Math.min(12, pts), notes };
}

function scoreLookingFor(user: ProfileUser): { pts: number; notes: string[] } {
  const notes: string[] = [];
  const lf = user.lookingFor ?? [];

  if (lf.length === 0) return { pts: 0, notes: ["No 'looking for' selected"] };

  let pts = 0;
  if (lf.length >= 1) pts += 4;
  if (lf.length >= 2) pts += 4;
  if (lf.length >= 3) pts += 4;

  if (lf.length >= 2) notes.push("Clear intentions set");
  else notes.push("Add more 'looking for' options");

  return { pts: Math.min(12, pts), notes };
}

function scoreVerification(user: ProfileUser): { pts: number; notes: string[] } {
  const notes: string[] = [];
  let pts = 0;

  if (user.isVerified) { pts += 8; notes.push("Profile verified"); }
  if (user.verifiedInstagramId) { pts += 4; notes.push("Instagram connected"); }
  if (user.showVipBadge) { pts += 4; notes.push("VIP badge"); }

  if (pts === 0) {
    notes.push("No verification -- add photo verification for trust");
  }

  return { pts: Math.min(16, pts), notes };
}

export function analyzeProfile(user: ProfileUser): ProfileAnalysis {
  const photoResult = scorePhotos(user);
  const bioResult = scoreBio(user);
  const interestsResult = scoreInterests(user);
  const tribesResult = scoreTribes(user);
  const lookingForResult = scoreLookingFor(user);
  const verificationResult = scoreVerification(user);

  const allStrengths: string[] = [];
  const allGaps: string[] = [];
  const allTips: string[] = [];

  const results = [
    { label: "Photos", ...photoResult, max: 22 },
    { label: "Bio", ...bioResult, max: 22 },
    { label: "Interests", ...interestsResult, max: 16 },
    { label: "Tribes", ...tribesResult, max: 12 },
    { label: "Looking For", ...lookingForResult, max: 12 },
    { label: "Verification", ...verificationResult, max: 16 },
  ];

  for (const r of results) {
    if (r.pts >= r.max * 0.7) {
      allStrengths.push(...r.notes.filter((n) => !n.includes("--") && !n.includes("No ") && !n.includes("too ") && !n.includes("Add ")));
    } else {
      allGaps.push(`${r.label}: ${r.notes.join("; ")}`);
    }
  }

  if (photoResult.pts < 15) allTips.push("Add at least 4 clear, well-lit photos");
  if (bioResult.pts < 15) allTips.push("Write a bio of 30+ words that shows personality");
  if (interestsResult.pts < 10) allTips.push("List 5+ interests for better matches");
  if (tribesResult.pts < 8) allTips.push("Select 1-2 tribes that fit your vibe");
  if (lookingForResult.pts < 8) allTips.push("Specify what you're looking for clearly");
  if (verificationResult.pts < 10) allTips.push("Verify your profile to build trust");

  if (allStrengths.length === 0) allStrengths.push("Profile exists");

  const correctScore = photoResult.pts + bioResult.pts + interestsResult.pts + tribesResult.pts + lookingForResult.pts + verificationResult.pts;

  return {
    score: correctScore,
    strengths: allStrengths,
    gaps: allGaps,
    tips: allTips,
  };
}
