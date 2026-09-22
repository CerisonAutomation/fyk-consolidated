/**
 * Context-Aware Reply Suggestions — Core AI feature (25.2)
 * Generates 2-3 one-tap replies from live context: last ~10 messages, relationship stage, tone.
 */

export type ReplySuggestion = {
  text: string;
  tone: "flirty" | "friendly" | "casual" | "direct" | "playful";
  intent: "icebreaker" | "escalation" | "plan" | "reengage" | "compliment" | "question";
  why: string;
};

export type ConversationContext = {
  messages: { sender: "me" | "them"; text: string; timestamp: number }[];
  stage: "new_match" | "talking" | "established" | "meeting_soon" | "cold";
  otherName: string;
  sharedInterests?: string[];
  myVibe?: string;
};

const STAGE_TEMPLATES: Record<string, ReplySuggestion[]> = {
  new_match: [
    { text: "Hey {name}! Your profile caught my eye — love your vibe 😊", tone: "friendly", intent: "icebreaker", why: "New match, friendly opener referencing profile" },
    { text: "Hi! I saw we share {interest} — tell me more?", tone: "casual", intent: "icebreaker", why: "Uses shared interest to break ice" },
    { text: "Hey {name}, how's your week going?", tone: "casual", intent: "icebreaker", why: "Simple, low-pressure opener" },
  ],
  talking: [
    { text: "Haha that's great! What else are you into?", tone: "playful", intent: "question", why: "Mid-thread, keeps momentum with question" },
    { text: "I like your energy — we should grab coffee sometime?", tone: "flirty", intent: "escalation", why: "Detects rapport, suggests low-pressure meet" },
    { text: "That's really interesting! Tell me more about {topic}", tone: "friendly", intent: "question", why: "Shows interest, extracts topic from last message" },
  ],
  established: [
    { text: "I've really enjoyed chatting! When are you free to meet?", tone: "direct", intent: "plan", why: "Long healthy thread, both online, suggests concrete plan" },
    { text: "You seem cool — want to swap numbers or meet for a drink?", tone: "flirty", intent: "escalation", why: "Established rapport, escalates naturally" },
    { text: "Haha, you're funny. What are you up to this weekend?", tone: "playful", intent: "plan", why: "Playful tone matches conversation, probes availability" },
  ],
  meeting_soon: [
    { text: "Looking forward to meeting! Still good for {day}?", tone: "friendly", intent: "plan", why: "Meeting stage, confirms plan" },
    { text: "Great, let's lock it in — what time works for you?", tone: "direct", intent: "plan", why: "Concrete time proposal" },
    { text: "Awesome! Any preferences for where we meet?", tone: "casual", intent: "plan", why: "Collaborative planning" },
  ],
  cold: [
    { text: "Hey! Still around? Would love to pick this up again 😊", tone: "friendly", intent: "reengage", why: "Thread going cold, re-engagement nudge" },
    { text: "No worries if busy — just wanted to say hi again!", tone: "casual", intent: "reengage", why: "Low-pressure re-engage" },
    { text: "Saw your profile again and remembered our chat — how's it going?", tone: "friendly", intent: "reengage", why: "References previous conversation" },
  ],
};

function extractTopic(text: string): string {
  const topics = ["music", "gym", "travel", "food", "movies", "books", "gaming", "dogs", "hiking", "coffee"];
  const lower = text.toLowerCase();
  for (const t of topics) {
    if (lower.includes(t)) return t;
  }
  return "that";
}

function detectColdThread(messages: ConversationContext["messages"]): boolean {
  if (messages.length < 2) return false;
  const last = messages[messages.length - 1];
  const timeSinceLast = Date.now() - last.timestamp;
  return timeSinceLast > 48 * 60 * 60 * 1000; // 48h
}

export function generateContextAwareReplies(context: ConversationContext): ReplySuggestion[] {
  const isCold = detectColdThread(context.messages);
  const effectiveStage = isCold ? "cold" : context.stage;

  let templates = STAGE_TEMPLATES[effectiveStage] ?? STAGE_TEMPLATES.talking;

  // Personalize with context
  const lastThem = [...context.messages].reverse().find((m) => m.sender === "them");
  const topic = lastThem ? extractTopic(lastThem.text) : "that";
  const interest = context.sharedInterests?.[0] ?? "a few things";

  const personalized = templates.map((t) => ({
    ...t,
    text: t.text
      .replace("{name}", context.otherName.split(" ")[0] ?? "there")
      .replace("{interest}", interest)
      .replace("{topic}", topic)
      .replace("{day}", "tomorrow"),
  }));

  // Return 2-3 suggestions
  return personalized.slice(0, 3);
}

export function generateSmartIcebreakers(profile: {
  displayName: string;
  interests: string[];
  bio?: string;
  photos: number;
}): ReplySuggestion[] {
  const name = profile.displayName.split(" ")[0] || "there";
  const interest = profile.interests[0] || "your vibe";

  return [
    {
      text: `Hey ${name}! I noticed you're into ${interest} — same here! What's your favorite part about it?`,
      tone: "friendly",
      intent: "icebreaker",
      why: `Uses their interest: ${interest}`,
    },
    {
      text: `Hi ${name}, your profile stood out — love the energy! How's your week going?`,
      tone: "casual",
      intent: "icebreaker",
      why: "General positive opener, avoids clichés",
    },
    {
      text: `Hey! I saw we both like ${interest} — have you been to any good spots for it lately?`,
      tone: "playful",
      intent: "icebreaker",
      why: `Shared interest hook: ${interest}`,
    },
  ];
}
