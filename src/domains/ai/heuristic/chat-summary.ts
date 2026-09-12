/**
 * chat-summary.ts
 * Summarizes a chat: topic extraction, question count, duration, action items.
 */

export interface ChatSummaryMessage {
  text: string;
  timestamp: number;
}

export interface ChatSummary {
  topics: string[];
  questionCount: number;
  durationMinutes: number;
  messageCount: number;
  actionItems: string[];
}


const TOPIC_PATTERNS: Array<{ pattern: RegExp; topic: string }> = [
  { pattern: /\b(gym|workout|fitness|muscle|lifting|exercise)\b/i, topic: "fitness" },
  { pattern: /\b(movie|film|cinema|watch|netflix|show|series)\b/i, topic: "entertainment" },
  { pattern: /\b(food|eat|cook|restaurant|dinner|lunch|coffee)\b/i, topic: "food" },
  { pattern: /\b(travel|trip|vacation|flight|hotel|beach)\b/i, topic: "travel" },
  { pattern: /\b(work|job|office|boss|career|meeting)\b/i, topic: "work" },
  { pattern: /\b(music|song|album|concert|band|playlist)\b/i, topic: "music" },
  { pattern: /\b(sports|game|team|player|score|league)\b/i, topic: "sports" },
  { pattern: /\b(sex|hookup|bedroom|position|fantasy)\b/i, topic: "intimacy" },
  { pattern: /\b(feel|feeling|emotion|happy|sad|anxious|stressed)\b/i, topic: "emotions" },
  { pattern: /\b(family|mom|dad|brother|sister|parent)\b/i, topic: "family" },
  { pattern: /\b(pet|dog|cat|animal|puppy|kitten)\b/i, topic: "pets" },
  { pattern: /\b(life|future|plan|goal|dream|purpose)\b/i, topic: "life" },
];

const ACTION_PATTERNS = [
  /\b(let'?s|we should|wanna|want to)\s+(meet|hang|grab|go|do|try|watch|play|visit)\b/i,
  /\b(what about|how about|shall we)\s+\w+/i,
  /\b(tomorrow|tonight|this weekend|friday|saturday|sunday)\b/i,
  /\b(send|share|text|call|message|reply)\b/i,
  /\b(maybe we can|i could|i'll|i will|we can)\s+\w+/i,
];

function extractTopics(messages: ChatSummaryMessage[]): string[] {
  const topicCounts = new Map<string, number>();

  for (const msg of messages) {
    for (const { pattern, topic } of TOPIC_PATTERNS) {
      if (pattern.test(msg.text)) {
        topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
      }
    }
  }

  return [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
}

function countQuestions(messages: ChatSummaryMessage[]): number {
  return messages.filter((m) => m.text.includes("?")).length;
}

function computeDuration(messages: ChatSummaryMessage[]): number {
  if (messages.length < 2) return 0;
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const durationMs = sorted[sorted.length - 1]!.timestamp - sorted[0]!.timestamp;
  return Math.round(durationMs / (1000 * 60));
}

function extractActionItems(messages: ChatSummaryMessage[]): string[] {
  const actions: string[] = [];

  for (const msg of messages) {
    for (const pattern of ACTION_PATTERNS) {
      const match = pattern.exec(msg.text);
      if (match) {
        const phrase = msg.text.slice(
          Math.max(0, match.index - 10),
          Math.min(msg.text.length, match.index + match[0].length + 20),
        );
        const cleaned = phrase.trim().replace(/[,.;:!?]+$/, "").slice(0, 80);
        if (cleaned.length > 5 && !actions.includes(cleaned)) {
          actions.push(cleaned);
          if (actions.length >= 5) return actions;
        }
      }
    }
  }

  return actions;
}

export function summarizeChat(messages: ChatSummaryMessage[]): ChatSummary {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  return {
    topics: extractTopics(sorted),
    questionCount: countQuestions(sorted),
    durationMinutes: computeDuration(sorted),
    messageCount: sorted.length,
    actionItems: extractActionItems(sorted),
  };
}
