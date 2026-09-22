/**
 * Predictive Autocomplete — MAX AUTOMATION — Zenith
 * Auto-infer user intent, recognize patterns, predictive suggestions
 * Uses embeddings, RAG memory, user history, context
 */

import { cosineSimilarity, createEmbedding } from "./embeddings";
import { retrieveMemories } from "./memory";

export interface PredictiveSuggestion {
  text: string;
  confidence: number;
  source: 'history' | 'memory' | 'trending' | 'context' | 'pattern';
  pattern?: string;
  autoInfer?: string;
}

export async function predictiveAutocomplete(
  userId: string,
  partial: string,
  context?: { conversationId?: string; profileId?: string; location?: string },
): Promise<PredictiveSuggestion[]> {
  const suggestions: PredictiveSuggestion[] = [];

  // 1. History-based: previous messages, searches
  try {
    const res = await fetch(`/api/ai/history?userId=${userId}&q=${encodeURIComponent(partial)}`);
    if (res.ok) {
      const data = await res.json();
      for (const item of (data.history || []).slice(0, 3)) {
        suggestions.push({
          text: item.text,
          confidence: 0.85,
          source: 'history',
          pattern: 'user_history',
          autoInfer: `User previously typed "${item.text}", auto-infer similar intent`,
        });
      }
    }
  } catch {}

  // 2. Memory RAG: pgvector semantic similarity
  try {
    const memories = await retrieveMemories(userId, partial, 3);
    for (const mem of memories) {
      const embedding = await createEmbedding(partial);
      const score = mem.embedding ? cosineSimilarity(embedding, mem.embedding) : 0.7;
      if (score > 0.6) {
        suggestions.push({
          text: mem.content,
          confidence: score,
          source: 'memory',
          pattern: 'semantic_memory',
          autoInfer: `Memory RAG matched "${mem.content.substring(0,30)}...", auto-infer relevant`,
        });
      }
    }
  } catch {}

  // 3. Context-aware: conversation, profile, location
  if (context?.conversationId) {
    try {
      const res = await fetch(`/api/ai/context-replies?conversationId=${context.conversationId}&q=${partial}`);
      if (res.ok) {
        const data = await res.json();
        for (const reply of (data.replies || []).slice(0, 2)) {
          suggestions.push({
            text: reply,
            confidence: 0.8,
            source: 'context',
            pattern: 'conversation_context',
            autoInfer: `Conversation context suggests "${reply.substring(0,20)}..."`,
          });
        }
      }
    } catch {}
  }

  // 4. Trending: popular in area, vs Grindr tags
  try {
    const res = await fetch(`/api/ai/trending?q=${partial}&location=${context?.location || ''}`);
    if (res.ok) {
      const data = await res.json();
      for (const trend of (data.trending || []).slice(0, 2)) {
        suggestions.push({
          text: trend,
          confidence: 0.65,
          source: 'trending',
          pattern: 'trending_local',
          autoInfer: `Trending in area: "${trend}", auto-infer popular`,
        });
      }
    }
  } catch {}

  // 5. Pattern recognition: recognize typing patterns, common phrases
  const commonPatterns: Record<string, string[]> = {
    'hey': ['Hey! How are you?', 'Hey there! What are you up to?', 'Hey! Saw your profile'],
    'what': ['What are you looking for?', 'What do you like to do?', 'What brings you here?'],
    'where': ['Where are you located?', 'Where do you like to hang out?', 'Where are you from?'],
    'how': ['How are you doing?', 'How was your day?', 'How do you know?'],
  };

  const lowerPartial = partial.toLowerCase();
  for (const [pattern, phrases] of Object.entries(commonPatterns)) {
    if (lowerPartial.includes(pattern) || pattern.includes(lowerPartial)) {
      for (const phrase of phrases.slice(0, 2)) {
        if (phrase.toLowerCase().includes(lowerPartial) || lowerPartial.length < 3) {
          suggestions.push({
            text: phrase,
            confidence: 0.7,
            source: 'pattern',
            pattern: `common_${pattern}`,
            autoInfer: `Recognized pattern "${pattern}", auto-infer "${phrase}"`,
          });
        }
      }
    }
  }

  // Dedupe and sort by confidence
  const seen = new Set<string>();
  const deduped = suggestions.filter(s => {
    if (seen.has(s.text)) return false;
    seen.add(s.text);
    return true;
  }).sort((a, b) => b.confidence - a.confidence).slice(0, 8);

  // Max automation: auto-complete if high confidence
  if (deduped.length > 0 && deduped[0].confidence > 0.9 && partial.length > 2) {
    deduped[0].autoInfer += ' — AUTO-COMPLETE HIGH CONFIDENCE';
  }

  return deduped;
}

export async function autoInferIntent(text: string): Promise<{ intent: string; confidence: number; entities: string[] }> {
  const lower = text.toLowerCase();
  const intents: Record<string, string[]> = {
    greeting: ['hey', 'hi', 'hello', 'yo'],
    question: ['what', 'where', 'how', 'when', 'why', 'who'],
    flirt: ['cute', 'hot', 'sexy', 'handsome', 'beautiful'],
    meet: ['meet', 'hang', 'coffee', 'drink', 'tonight', 'now'],
    location: ['nearby', 'close', 'distance', 'location', 'where'],
    safety: ['block', 'report', 'safe', 'emergency'],
  };

  let bestIntent = 'general';
  let bestScore = 0;
  const entities: string[] = [];

  for (const [intent, keywords] of Object.entries(intents)) {
    const matches = keywords.filter(k => lower.includes(k)).length;
    const score = matches / keywords.length;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
    if (matches > 0) entities.push(...keywords.filter(k => lower.includes(k)));
  }

  return { intent: bestIntent, confidence: bestScore, entities: [...new Set(entities)] };
}

export function recognizePatterns(messages: string[]): { pattern: string; frequency: number; example: string }[] {
  const patterns: Record<string, { count: number; example: string }> = {};

  for (const msg of messages) {
    const words = msg.toLowerCase().split(/\s+/);
    // Bigram patterns
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i+1]}`;
      if (!patterns[bigram]) patterns[bigram] = { count: 0, example: msg };
      patterns[bigram].count++;
    }
  }

  return Object.entries(patterns)
    .filter(([_, v]) => v.count > 1)
    .map(([pattern, v]) => ({ pattern, frequency: v.count, example: v.example }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}
