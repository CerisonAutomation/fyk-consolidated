/**
 * Pattern Recognition — MAX AUTOMATION — Zenith
 * Recognize patterns in messages, behavior, preferences, safety
 */

export interface Pattern {
  id: string;
  type: 'communication' | 'behavior' | 'preference' | 'safety' | 'temporal';
  pattern: string;
  frequency: number;
  confidence: number;
  examples: string[];
  autoInfer?: string;
}

export function recognizeCommunicationPatterns(messages: Array<{ content: string; sender: string; createdAt: string }>): Pattern[] {
  const patterns: Pattern[] = [];

  // Greeting patterns
  const greetings = messages.filter(m => /^(hey|hi|hello|yo|hola)\b/i.test(m.content));
  if (greetings.length > 2) {
    patterns.push({
      id: 'greeting_frequent',
      type: 'communication',
      pattern: 'Frequent greetings',
      frequency: greetings.length,
      confidence: 0.9,
      examples: greetings.slice(0,3).map(m => m.content),
      autoInfer: `User frequently greets, auto-infer friendly communication style`,
    });
  }

  // Question patterns
  const questions = messages.filter(m => m.content.includes('?'));
  if (questions.length > messages.length * 0.5) {
    patterns.push({
      id: 'question_heavy',
      type: 'communication',
      pattern: 'Question-heavy communication',
      frequency: questions.length,
      confidence: 0.85,
      examples: questions.slice(0,3).map(m => m.content),
      autoInfer: `User asks many questions, auto-infer curious, engagement high`,
    });
  }

  // Emoji patterns
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/u;
  const emojiMessages = messages.filter(m => emojiRegex.test(m.content));
  if (emojiMessages.length > messages.length * 0.3) {
    patterns.push({
      id: 'emoji_frequent',
      type: 'communication',
      pattern: 'Emoji-rich communication',
      frequency: emojiMessages.length,
      confidence: 0.8,
      examples: emojiMessages.slice(0,3).map(m => m.content),
      autoInfer: `Emoji frequent, auto-infer expressive, flirty style`,
    });
  }

  // Short vs long messages
  const avgLength = messages.reduce((sum, m) => sum + m.content.length, 0) / (messages.length || 1);
  if (avgLength < 30) {
    patterns.push({
      id: 'short_messages',
      type: 'communication',
      pattern: 'Short message pattern',
      frequency: messages.length,
      confidence: 0.75,
      examples: messages.slice(0,3).map(m => m.content),
      autoInfer: `Avg ${Math.round(avgLength)} chars, auto-infer direct, fast-paced`,
    });
  } else if (avgLength > 150) {
    patterns.push({
      id: 'long_messages',
      type: 'communication',
      pattern: 'Long message pattern',
      frequency: messages.length,
      confidence: 0.75,
      examples: messages.slice(0,3).map(m => m.content.substring(0,100)),
      autoInfer: `Avg ${Math.round(avgLength)} chars, auto-infer thoughtful, formal`,
    });
  }

  return patterns;
}

export function recognizeBehavioralPatterns(actions: Array<{ type: string; timestamp: string; metadata?: any }>): Pattern[] {
  const patterns: Pattern[] = [];

  // Time-based patterns
  const hourCounts: Record<number, number> = {};
  for (const action of actions) {
    const hour = new Date(action.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  const sortedHours = Object.entries(hourCounts).sort((a,b) => b[1]-a[1]);
  if (sortedHours.length > 0 && sortedHours[0][1] > actions.length * 0.3) {
    const topHour = parseInt(sortedHours[0][0]);
    patterns.push({
      id: 'active_hour',
      type: 'temporal',
      pattern: `Active at ${topHour}:00`,
      frequency: sortedHours[0][1],
      confidence: 0.9,
      examples: [`Most active at ${topHour}:00`],
      autoInfer: `User most active at ${topHour}:00, auto-infer best time to boost/message`,
    });
  }

  // Action sequence patterns
  const actionTypes = actions.map(a => a.type);
  const bigrams: Record<string, number> = {};
  for (let i = 0; i < actionTypes.length - 1; i++) {
    const bigram = `${actionTypes[i]} → ${actionTypes[i+1]}`;
    bigrams[bigram] = (bigrams[bigram] || 0) + 1;
  }

  for (const [bigram, count] of Object.entries(bigrams)) {
    if (count > 2) {
      patterns.push({
        id: `sequence_${bigram.replace(/\s/g, '_')}`,
        type: 'behavior',
        pattern: bigram,
        frequency: count,
        confidence: 0.8,
        examples: [bigram],
        autoInfer: `Sequence ${bigram} occurs ${count} times, auto-infer habitual flow`,
      });
    }
  }

  // Boost patterns
  const boosts = actions.filter(a => a.type === 'boost');
  if (boosts.length > 3) {
    patterns.push({
      id: 'frequent_booster',
      type: 'behavior',
      pattern: 'Frequent booster',
      frequency: boosts.length,
      confidence: 0.85,
      examples: boosts.slice(0,3).map(b => b.timestamp),
      autoInfer: `User boosts frequently ${boosts.length} times, auto-infer high engagement, suggest subscription`,
    });
  }

  return patterns;
}

export function recognizeSafetyPatterns(messages: Array<{ content: string; sender: string }>): Pattern[] {
  const patterns: Pattern[] = [];

  const toxicityKeywords = ['hate', 'kill', 'stupid', 'idiot', 'harass', 'stalk'];
  const spamKeywords = ['buy now', 'click here', 'free money', 'crypto'];

  const toxicMessages = messages.filter(m => toxicityKeywords.some(k => m.content.toLowerCase().includes(k)));
  if (toxicMessages.length > 0) {
    patterns.push({
      id: 'toxicity_detected',
      type: 'safety',
      pattern: 'Toxicity keywords detected',
      frequency: toxicMessages.length,
      confidence: 0.9,
      examples: toxicMessages.slice(0,3).map(m => m.content.substring(0,50)),
      autoInfer: `Toxicity detected ${toxicMessages.length} times, auto-infer safety risk, suggest block/report`,
    });
  }

  const spamMessages = messages.filter(m => spamKeywords.some(k => m.content.toLowerCase().includes(k)));
  if (spamMessages.length > 1) {
    patterns.push({
      id: 'spam_pattern',
      type: 'safety',
      pattern: 'Spam pattern',
      frequency: spamMessages.length,
      confidence: 0.95,
      examples: spamMessages.slice(0,3).map(m => m.content.substring(0,50)),
      autoInfer: `Spam pattern ${spamMessages.length} times, auto-infer bot, auto-block`,
    });
  }

  return patterns;
}

export function recognizePreferencePatterns(profileViews: Array<{ tags: string[]; age: number; distance: number }>): Pattern[] {
  const patterns: Pattern[] = [];

  // Tag preferences
  const tagCounts: Record<string, number> = {};
  for (const view of profileViews) {
    for (const tag of view.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const topTags = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0,5);
  for (const [tag, count] of topTags) {
    if (count > profileViews.length * 0.3) {
      patterns.push({
        id: `pref_tag_${tag}`,
        type: 'preference',
        pattern: `Prefers ${tag}`,
        frequency: count,
        confidence: 0.85,
        examples: [`Viewed ${count} profiles with ${tag}`],
        autoInfer: `User prefers ${tag} ${count} times, auto-infer filter suggestion`,
      });
    }
  }

  // Age preference
  const avgAge = profileViews.reduce((sum, v) => sum + (v.age || 25), 0) / (profileViews.length || 1);
  patterns.push({
    id: 'pref_age',
    type: 'preference',
    pattern: `Avg viewed age ${Math.round(avgAge)}`,
    frequency: profileViews.length,
    confidence: 0.8,
    examples: [`Average age ${Math.round(avgAge)}`],
    autoInfer: `Avg viewed age ${Math.round(avgAge)}, auto-infer age filter`,
  });

  return patterns;
}
