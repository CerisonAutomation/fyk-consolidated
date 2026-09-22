/**
 * Rizz Meter / Conversation Health — AI feature 25.6
 * Live gauge per thread tracking engagement, momentum, tone drift.
 */

export type RizzScore = {
  overall: number; // 0-100
  engagement: number;
  momentum: number;
  tone: number;
  trend: "rising" | "stable" | "falling" | "dying";
  flags: string[];
  suggestions: string[];
  streak: number; // consecutive days
};

export type MessageForRizz = {
  sender: "me" | "them";
  text: string;
  timestamp: number;
  length: number;
};

export function calculateRizzScore(messages: MessageForRizz[]): RizzScore {
  if (messages.length === 0) {
    return { overall: 0, engagement: 0, momentum: 0, tone: 0, trend: "dying", flags: ["no_messages"], suggestions: ["Start the conversation!"], streak: 0 };
  }

  const recent = messages.slice(-10);
  const myMessages = recent.filter((m) => m.sender === "me");
  const theirMessages = recent.filter((m) => m.sender === "them");

  // Engagement: reply speed + length balance
  const avgMyLength = myMessages.reduce((s, m) => s + m.length, 0) / Math.max(1, myMessages.length);
  const avgTheirLength = theirMessages.reduce((s, m) => s + m.length, 0) / Math.max(1, theirMessages.length);
  const lengthBalance = Math.min(avgMyLength, avgTheirLength) / Math.max(avgMyLength, avgTheirLength, 1);
  const engagement = Math.round((lengthBalance * 0.5 + (theirMessages.length / Math.max(1, recent.length)) * 0.5) * 100);

  // Momentum: cadence (time between messages)
  let momentum = 50;
  if (recent.length >= 2) {
    const gaps = [];
    for (let i = 1; i < recent.length; i++) {
      gaps.push(recent[i].timestamp - recent[i - 1].timestamp);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    // <1h = high momentum, >24h = low
    if (avgGap < 60 * 60 * 1000) momentum = 90;
    else if (avgGap < 6 * 60 * 60 * 1000) momentum = 70;
    else if (avgGap < 24 * 60 * 60 * 1000) momentum = 50;
    else momentum = 20;
  }

  // Tone: positive words vs negative
  const positiveWords = ["great", "awesome", "love", "like", "fun", "good", "nice", "haha", "lol", "😊", "❤️", "🔥"];
  const negativeWords = ["sorry", "busy", "maybe", "not", "can't", "don't"];
  let toneScore = 50;
  const allText = recent.map((m) => m.text.toLowerCase()).join(" ");
  const posCount = positiveWords.filter((w) => allText.includes(w)).length;
  const negCount = negativeWords.filter((w) => allText.includes(w)).length;
  toneScore = Math.max(0, Math.min(100, 50 + posCount * 10 - negCount * 5));

  const overall = Math.round((engagement * 0.4 + momentum * 0.35 + toneScore * 0.25));

  let trend: RizzScore["trend"] = "stable";
  if (recent.length >= 4) {
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstAvg = firstHalf.filter((m) => m.sender === "them").length;
    const secondAvg = secondHalf.filter((m) => m.sender === "them").length;
    if (secondAvg > firstAvg) trend = "rising";
    else if (secondAvg < firstAvg) trend = "falling";
    if (overall < 30) trend = "dying";
  }

  const flags: string[] = [];
  const suggestions: string[] = [];

  if (overall < 30) {
    flags.push("dying_conversation");
    suggestions.push("This thread is going cold — try: 'Hey, want to grab coffee this week?'");
  }
  if (momentum < 30) {
    flags.push("low_momentum");
    suggestions.push("Reply faster or ask an engaging question");
  }
  if (engagement < 30) {
    flags.push("low_engagement");
    suggestions.push("Their replies are short — try changing topic to something they like");
  }
  if (overall > 80) {
    suggestions.push("Great momentum! Consider asking to meet 🔥");
  }

  // Streak: consecutive days with messages
  const days = new Set(messages.map((m) => new Date(m.timestamp).toISOString().slice(0, 10)));
  const streak = days.size;

  return { overall, engagement, momentum, tone: toneScore, trend, flags, suggestions, streak };
}

export function shouldCelebrate(score: RizzScore): boolean {
  return score.overall > 85 && score.trend === "rising";
}
