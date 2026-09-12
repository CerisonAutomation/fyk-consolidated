/**
 * meeting-suggest.ts
 * Suggests meeting based on conversation depth and days chatted.
 * Returns confidence score and reasoning.
 */

export interface MeetingMessage {
  text: string;
  timestamp: number;
}

export interface MeetingSuggestion {
  confidence: number;
  reason: string;
}

function computeConversationDepth(messages: MeetingMessage[]): number {
  if (messages.length === 0) return 0;

  const avgLength =
    messages.reduce((sum, m) => sum + m.text.length, 0) / messages.length;

  const questionCount = messages.filter((m) => m.text.includes("?")).length;
  const questionRatio = questionCount / messages.length;

  const personalKeywords = [
    "love", "feel", "dream", "want", "need", "hope", "fear",
    "family", "friend", "work", "life", "future", "past",
    "like", "enjoy", "prefer", "favorite", "best", "worst",
  ];
  let personalHits = 0;
  for (const msg of messages) {
    const lower = msg.text.toLowerCase();
    for (const kw of personalKeywords) {
      if (lower.includes(kw)) personalHits++;
    }
  }
  const personalRatio = Math.min(1, personalHits / messages.length);

  let score = 0;
  if (avgLength >= 30) score += 30;
  else if (avgLength >= 15) score += 20;
  else if (avgLength >= 8) score += 10;

  score += Math.round(questionRatio * 30);
  score += Math.round(personalRatio * 40);

  return Math.min(100, score);
}

function computeComfort(messages: MeetingMessage[]): number {
  if (messages.length < 4) return 20;

  const midpoint = Math.floor(messages.length / 2);
  const secondHalf = messages.slice(midpoint);

  const midKeywords = [
    "sure", "yes", "okay", "definitely", "absolutely", "love to",
    "sounds good", "count me in", "down", "when", "where",
  ];

  let comfortHits = 0;
  for (const msg of secondHalf) {
    const lower = msg.text.toLowerCase();
    for (const kw of midKeywords) {
      if (lower.includes(kw)) comfortHits++;
    }
  }

  return Math.min(100, 20 + comfortHits * 15);
}

export function suggestMeeting(
  messages: MeetingMessage[],
  daysChatted: number,
): MeetingSuggestion {
  const depth = computeConversationDepth(messages);
  const comfort = computeComfort(messages);

  let confidence = 0;
  confidence += depth * 0.4;
  confidence += comfort * 0.3;

  if (daysChatted >= 7) confidence += 20;
  else if (daysChatted >= 3) confidence += 10;
  else confidence += 5;

  if (messages.length >= 20) confidence += 10;
  else if (messages.length >= 10) confidence += 5;

  confidence = Math.round(Math.min(100, Math.max(0, confidence)));

  let reason: string;
  if (confidence >= 75) {
    reason = "Great rapport built -- strong candidate for meeting";
  } else if (confidence >= 50) {
    reason = "Good connection forming -- consider suggesting a casual meetup";
  } else if (confidence >= 30) {
    reason = "Conversation is building -- try deepening before suggesting a meet";
  } else {
    reason = "Still early -- keep chatting to build comfort and trust";
  }

  return { confidence, reason };
}
