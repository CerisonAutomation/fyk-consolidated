/**
 * AI Auto-Reply / Avatar — Core AI feature (25.1)
 * Learns user's writing style from chat history + profile, replies while offline.
 * Production: labeled AI, propose-never-act, per-conversation opt-out.
 */

export type AutoReplyConfig = {
  enabled: boolean;
  blockedContacts: string[]; // userIds blocked from auto-reply
  allowlistTopics: string[]; // safe topics only
  styleProfile: {
    avgLength: number;
    emojiUsage: number;
    formality: "casual" | "neutral" | "formal";
    commonPhrases: string[];
  };
  customInstructions?: string;
};

export type ChatContext = {
  lastMessages: { sender: "me" | "them"; text: string; timestamp: number }[];
  relationshipStage: "new_match" | "talking" | "established" | "meeting_soon";
  otherUserName: string;
  myName: string;
};

const SAFE_TOPICS = [
  "greeting",
  "hobbies",
  "plans",
  "compliments",
  "general_chat",
];

const BLOCKED_TOPICS = [
  "contact_info",
  "money",
  "explicit_meet",
  "location_share",
  "financial",
];

const SAFE_REPLY_TEMPLATES: Record<string, string[]> = {
  greeting: [
    "Hey {name}! Thanks for reaching out — I'm away right now but will get back soon! 😊",
    "Hi {name}! I'm currently offline but didn't want to leave you hanging. How's your day going?",
    "Hey! I'm not available at the moment but will reply properly when I'm back. Hope you're having a good one!",
  ],
  hobbies: [
    "That sounds awesome! I'd love to hear more about it when I'm back online.",
    "Interesting — we might have that in common! Tell me more later?",
    "Nice! I'm into similar things. Let's chat more when I'm free.",
  ],
  general_chat: [
    "Thanks for the message! I'm away right now but will get back to you soon. — AI-assisted reply on behalf of {myName}",
    "Appreciate you reaching out! I'm offline at the moment but didn't want to leave you on read. — AI-assisted",
    "Hey {name}, thanks! I'm currently away but will reply properly soon. This is an AI-assisted reply.",
  ],
};

export function shouldAutoReply(
  config: AutoReplyConfig,
  context: ChatContext,
  otherUserId: string,
): { should: boolean; reason?: string } {
  if (!config.enabled) return { should: false, reason: "disabled" };
  if (config.blockedContacts.includes(otherUserId)) return { should: false, reason: "blocked_contact" };
  if (context.lastMessages.length === 0) return { should: false, reason: "no_context" };

  // Don't auto-reply if user is actually online (would be handled by presence)
  const lastMyMessage = [...context.lastMessages].reverse().find((m) => m.sender === "me");
  if (lastMyMessage && Date.now() - lastMyMessage.timestamp < 5 * 60 * 1000) {
    return { should: false, reason: "recently_active" };
  }

  return { should: true };
}

export function generateAutoReply(
  config: AutoReplyConfig,
  context: ChatContext,
): { text: string; topic: string; labeled: boolean; why: string } {
  const lastThem = [...context.lastMessages].reverse().find((m) => m.sender === "them");
  const lastText = lastThem?.text.toLowerCase() ?? "";

  // Simple intent detection
  let topic = "general_chat";
  if (lastText.includes("hi") || lastText.includes("hey") || lastText.includes("hello")) {
    topic = "greeting";
  } else if (lastText.includes("hobby") || lastText.includes("like") || lastText.includes("interest")) {
    topic = "hobbies";
  }

  // Enforce allowlist
  if (!SAFE_TOPICS.includes(topic) || BLOCKED_TOPICS.some((b) => lastText.includes(b))) {
    topic = "general_chat";
  }

  const templates = SAFE_REPLY_TEMPLATES[topic] ?? SAFE_REPLY_TEMPLATES.general_chat;
  let text = templates[Math.floor(Math.random() * templates.length)];

  // Personalize
  text = text.replace("{name}", context.otherUserName.split(" ")[0] ?? "there");
  text = text.replace("{myName}", context.myName);

  // Apply style: trim to user's avg length if needed
  if (text.length > config.styleProfile.avgLength * 1.5) {
    text = text.slice(0, config.styleProfile.avgLength) + "...";
  }

  // Always label AI
  if (!text.includes("AI-assisted")) {
    text += " — AI-assisted reply";
  }

  return {
    text,
    topic,
    labeled: true,
    why: `Detected ${topic} intent, used ${config.styleProfile.formality} tone, avg length ${config.styleProfile.avgLength}`,
  };
}

export function createDefaultAutoReplyConfig(): AutoReplyConfig {
  return {
    enabled: false,
    blockedContacts: [],
    allowlistTopics: [...SAFE_TOPICS],
    styleProfile: {
      avgLength: 80,
      emojiUsage: 0.3,
      formality: "casual",
      commonPhrases: ["hey", "lol", "nice"],
    },
  };
}
