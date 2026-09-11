/**
 * index.ts
 * Barrel export for the AI heuristic engine.
 */

export {
  computeMatchScore,
  type MatchUser,
  type MatchResult,
  type MatchDimension,
  type Vibe as MatchVibe,
} from "./match-score";

export {
  detectIntent,
  type Intent,
  type IntentResult,
} from "./intent-detect";

export {
  suggestReplies,
} from "./reply-suggest";

export {
  generateIcebreakers,
  type IcebreakerTarget,
} from "./icebreakers";

export {
  moderateContent,
  type Verdict,
  type ModerationResult,
} from "./moderate";

export {
  analyzeChatHealth,
  type ChatMessage,
  type ChatHealthResult,
} from "./chat-health";

export {
  predictChurn,
  type ChurnMessage,
  type ChurnResult,
} from "./churn-predict";

export {
  suggestMeeting,
  type MeetingMessage,
  type MeetingSuggestion,
} from "./meeting-suggest";

export {
  translate,
  type SupportedLang,
} from "./translate";

export {
  generateBio,
  type BioUser,
} from "./bio-generate";

export {
  summarizeChat,
  type ChatSummaryMessage,
  type ChatSummary,
} from "./chat-summary";

export {
  analyzeProfile,
  type ProfileUser,
  type ProfileAnalysis,
} from "./profile-analyze";

export {
  rankPhotos,
  type Photo,
  type RankedPhoto,
} from "./photo-rank";

export {
  generatePickupLines,
} from "./pickup-lines";

export {
  planDate,
  type BudgetTier,
  type DatePlan,
} from "./date-plan";

export {
  detectChatfishing,
  type ScamMessage,
  type ScamResult,
} from "./scam-detect";

export {
  inferVibe,
  type VibeType,
  type VibeResult,
  type VibeUser,
} from "./vibe-infer";
