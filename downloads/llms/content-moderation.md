# AI Content Moderation Web Application Patterns

> Practical implementation patterns for building automated content moderation systems using AI/ML.

## Overview

Content moderation systems classify, filter, and flag user-generated content for safety. This covers text toxicity detection, image NSFW classification, and hybrid approaches combining AI with human review.

---

## Architecture Overview

```
User Content (Text/Image/Video)
    |
    v
[Pre-Processing]
    |
    +--> [Client-Side Filter] (Fast, basic checks)
    |
    +--> [Server-Side AI] (Deep analysis)
    |       |
    |       +--> [Text Moderation] (Toxicity, spam, PII)
    |       +--> [Image Moderation] (NSFW, violence, gore)
    |       +--> [Multi-Modal] (Text + Image context)
    |
    v
[Decision Engine]
    |
    +--> [Auto-Approve] (High confidence safe)
    +--> [Auto-Block] (High confidence violation)
    +--> [Queue for Review] (Uncertain cases)
    |
    v
[Human Review Dashboard]
    |
    v
[Policy Enforcement]
```

---

## Text Moderation

### 1. OpenAI Moderation API

Free to use, multi-category detection:

```javascript
import OpenAI from 'openai';

const openai = new OpenAI();

async function moderateText(text) {
  const response = await openai.moderations.create({
    model: 'omni-moderation-latest',
    input: text,
  });

  const result = response.results[0];

  return {
    flagged: result.flagged,
    categories: result.categories,
    categoryScores: result.category_scores,
    categoryAppliedInputTypes: result.category_applied_input_types,
  };
}

// Categories detected:
// - hate: Hate speech
// - harassment: Harassment/bullying
// - self-harm: Self-harm content
// - sexual: Sexual content
// - violence: Violence/gore
// - illicit: Illegal activities
```

### 2. Inline Moderation (Generate + Moderate)

```javascript
async function generateWithModeration(prompt) {
  const response = await openai.responses.create({
    model: 'gpt-4o',
    input: [{ role: 'user', content: prompt }],
    moderation: { model: 'omni-moderation-latest' },
  });

  // Check both input and output
  const inputFlagged = response.moderation?.input?.flagged;
  const outputFlagged = response.moderation?.output?.flagged;

  if (inputFlagged || outputFlagged) {
    return { blocked: true, reason: 'Content policy violation' };
  }

  return { blocked: false, output: response.output_text };
}
```

### 3. Hugging Face Toxicity Detection (Client-Side)

```javascript
import { pipeline } from '@huggingface/transformers';

// Load toxicity classifier
const classifier = await pipeline(
  'text-classification',
  'Xenova/toxic-bert',
  { device: 'webgpu' }  // or 'wasm'
);

async function moderateTextLocal(text) {
  const results = await classifier(text);

  const toxicityScore = results.find(r => r.label === 'toxic')?.score || 0;
  const isToxic = toxicityScore > 0.7;

  return {
    flagged: isToxic,
    score: toxicityScore,
    label: isToxic ? 'toxic' : 'safe',
  };
}
```

### 4. Multi-Category Classification

```javascript
import { pipeline } from '@huggingface/transformers';

const classifier = await pipeline(
  'zero-shot-classification',
  'Xenova/bart-large-mnli'
);

async function classifyContent(text) {
  const categories = [
    'hate speech',
    'harassment',
    'self-harm',
    'sexual content',
    'violence',
    'spam',
    'safe content',
  ];

  const result = await classifier(text, categories, {
    multi_label: true,
  });

  // Get all categories above threshold
  const flaggedCategories = result.labels
    .map((label, i) => ({ label, score: result.scores[i] }))
    .filter(item => item.score > 0.5 && item.label !== 'safe content');

  return {
    flagged: flaggedCategories.length > 0,
    categories: flaggedCategories,
    isSafe: flaggedCategories.length === 0,
  };
}
```

---

## Image Moderation

### 1. NSFW Classification

```javascript
import { pipeline } from '@huggingface/transformers';

const classifier = await pipeline(
  'image-classification',
  'Xenova/nsfw-image-classification'
);

async function moderateImage(imageUrl) {
  const results = await classifier(imageUrl);

  const nsfwScore = results.find(r => r.label === 'nsfw')?.score || 0;
  const isNSFW = nsfwScore > 0.7;

  return {
    flagged: isNSFW,
    score: nsfwScore,
    label: isNSFW ? 'nsfw' : 'safe',
  };
}
```

### 2. Multi-Category Image Moderation

```javascript
const classifier = await pipeline(
  'zero-shot-image-classification',
  'Xenova/clip-vit-base-patch32'
);

async function moderateImageDetailed(imageUrl) {
  const categories = [
    'safe content',
    'nsfw content',
    'violence',
    'gore',
    'hate symbols',
    'drug use',
  ];

  const result = await classifier(imageUrl, categories);

  const flagged = result.labels
    .map((label, i) => ({ label, score: result.scores[i] }))
    .filter(item => item.score > 0.6 && item.label !== 'safe content');

  return {
    flagged: flagged.length > 0,
    categories: flagged,
    isSafe: flagged.length === 0,
  };
}
```

---

## Hybrid Moderation Pattern

### 1. Layered Approach

```javascript
class ContentModerator {
  constructor() {
    this.textClassifier = null;
    this.imageClassifier = null;
  }

  async init() {
    this.textClassifier = await pipeline(
      'text-classification',
      'Xenova/toxic-bert'
    );
    this.imageClassifier = await pipeline(
      'image-classification',
      'Xenova/nsfw-image-classification'
    );
  }

  async moderate(content) {
    const results = {
      text: null,
      image: null,
      overall: 'safe',
      confidence: 1.0,
    };

    // Layer 1: Fast rule-based checks
    if (this.containsBannedWords(content.text)) {
      return { flagged: true, reason: 'banned_words', layer: 'rules' };
    }

    // Layer 2: AI text analysis
    if (content.text) {
      results.text = await this.moderateText(content.text);
    }

    // Layer 3: AI image analysis
    if (content.imageUrl) {
      results.image = await this.moderateImage(content.imageUrl);
    }

    // Layer 4: Combined scoring
    const maxScore = Math.max(
      results.text?.score || 0,
      results.image?.score || 0
    );

    if (maxScore > 0.9) {
      results.overall = 'blocked';
    } else if (maxScore > 0.7) {
      results.overall = 'review';
    } else {
      results.overall = 'approved';
    }

    results.confidence = 1 - maxScore;

    return results;
  }

  containsBannedWords(text) {
    const bannedPatterns = [/slur1/i, /slur2/i]; // Your patterns
    return bannedPatterns.some(p => p.test(text));
  }

  async moderateText(text) {
    const results = await this.textClassifier(text);
    const score = results[0]?.score || 0;
    return {
      flagged: score > 0.7,
      score,
      label: results[0]?.label,
    };
  }

  async moderateImage(imageUrl) {
    const results = await this.imageClassifier(imageUrl);
    const score = results.find(r => r.label === 'nsfw')?.score || 0;
    return {
      flagged: score > 0.7,
      score,
    };
  }
}

// Usage
const moderator = new ContentModerator();
await moderator.init();

const result = await moderator.moderate({
  text: 'Check out this photo!',
  imageUrl: 'https://example.com/photo.jpg',
});

if (result.overall === 'blocked') {
  // Auto-block
} else if (result.overall === 'review') {
  // Queue for human review
} else {
  // Auto-approve
}
```

---

## Human Review Queue

### 1. Queue Management

```sql
-- Moderation queue table
CREATE TABLE moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,  -- 'text', 'image', 'video'
  content_text TEXT,
  content_url TEXT,
  user_id UUID REFERENCES users(id),
  ai_score FLOAT,
  ai_categories JSONB,
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'escalated'
  reviewer_id UUID,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Index for fast queue queries
CREATE INDEX idx_moderation_queue_status ON moderation_queue(status, created_at);
CREATE INDEX idx_moderation_queue_score ON moderation_queue(ai_score DESC);
```

### 2. Queue API

```javascript
// Get next items for review
async function getNextForReview(limit = 10) {
  const { data, error } = await supabase
    .from('moderation_queue')
    .select('*')
    .eq('status', 'pending')
    .order('ai_score', { ascending: false })  // Highest risk first
    .limit(limit);

  return data;
}

// Submit review decision
async function submitReview(queueId, decision, reviewerId, notes) {
  const { error } = await supabase
    .from('moderation_queue')
    .update({
      status: decision,  // 'approved' or 'rejected'
      reviewer_id: reviewerId,
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', queueId);

  if (error) throw error;

  // Log decision for model improvement
  await logModerationDecision(queueId, decision, notes);
}
```

---

## Real-Time Moderation

### 1. WebSocket-Based Moderation

```javascript
// Server-side
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
const moderator = new ContentModerator();
await moderator.init();

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const content = JSON.parse(data);

    // Moderate in real-time
    const result = await moderator.moderate(content);

    // Send result back
    ws.send(JSON.stringify({
      type: 'moderation_result',
      result,
    }));
  });
});
```

### 2. Client-Side Pre-Moderation

```javascript
// Before posting content
async function preModerate(content) {
  // Quick client-side check
  const result = await moderator.moderateLocal(content);

  if (result.flagged) {
    // Show warning before posting
    showWarning('Your content may violate our guidelines');
    return false;
  }

  return true;
}

// On form submit
document.getElementById('post-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const content = {
    text: document.getElementById('text-input').value,
    imageUrl: document.getElementById('image-preview')?.src,
  };

  const canPost = await preModerate(content);
  if (canPost) {
    // Submit to server
    await submitPost(content);
  }
});
```

---

## Decision Engine

### 1. Rule-Based Decisions

```javascript
function makeDecision(moderationResult) {
  const { text, image, overall } = moderationResult;

  // Auto-block: High confidence violations
  if (overall === 'blocked') {
    return {
      action: 'block',
      reason: 'High confidence content violation',
      autoDecided: true,
    };
  }

  // Queue for review: Uncertain cases
  if (overall === 'review') {
    return {
      action: 'review',
      reason: 'AI confidence below threshold',
      autoDecided: false,
    };
  }

  // Auto-approve: High confidence safe
  if (overall === 'approved') {
    return {
      action: 'approve',
      reason: 'Content appears safe',
      autoDecided: true,
    };
  }

  // Default: Queue for review
  return {
    action: 'review',
    reason: 'Default to human review',
    autoDecided: false,
  };
}
```

### 2. Escalation Rules

```javascript
function shouldEscalate(result, userHistory) {
  // Escalate if user has prior violations
  if (userHistory.violationCount > 3) {
    return true;
  }

  // Escalate if content is borderline
  if (result.confidence < 0.7 && result.confidence > 0.3) {
    return true;
  }

  // Escalate if multiple categories flagged
  if (result.categories.length > 2) {
    return true;
  }

  return false;
}
```

---

## Feedback Loop

### 1. Track Moderation Outcomes

```sql
CREATE TABLE moderation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES moderation_queue(id),
  ai_prediction TEXT,
  ai_score FLOAT,
  human_decision TEXT,
  is_correct BOOLEAN,
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- View accuracy metrics
SELECT
  ai_prediction,
  human_decision,
  COUNT(*) as total,
  SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
  AVG(CASE WHEN is_correct THEN 1 ELSE 0 END) as accuracy
FROM moderation_feedback
GROUP BY ai_prediction, human_decision;
```

### 2. Model Improvement

```javascript
// Collect training data from human decisions
async function collectTrainingData() {
  const { data } = await supabase
    .from('moderation_feedback')
    .select('*')
    .eq('is_correct', true);

  // Use correct predictions to fine-tune or create evaluation dataset
  return data.map(item => ({
    text: item.content_text,
    label: item.human_decision,
  }));
}
```

---

## Deployment Checklist

1. **Layer your moderation:** Rules -> AI -> Human review
2. **Set confidence thresholds:** Tune based on your content type
3. **Implement feedback loop:** Track accuracy, improve over time
4. **Build review dashboard:** Make human review efficient
5. **Handle edge cases:** Borderline content, appeals, false positives
6. **Monitor metrics:** Track false positive/negative rates
7. **Scale asynchronously:** Use queues for high-volume moderation
8. **Document policies:** Clear rules for moderators and users

---

## Quick Reference

```javascript
// OpenAI Moderation (Server)
const result = await openai.moderations.create({
  model: 'omni-moderation-latest',
  input: text,
});

// Hugging Face (Client)
const classifier = await pipeline('text-classification', 'Xenova/toxic-bert');
const result = await classifier(text);

// Zero-Shot (Flexible)
const classifier = await pipeline('zero-shot-classification');
const result = await classifier(text, ['safe', 'toxic', 'spam']);
```
