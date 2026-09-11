# Recommendation System Patterns for Web Applications

> Practical implementation patterns for building recommendation engines, including collaborative filtering, content-based filtering, and hybrid approaches for dating/matching apps.

## Overview

Recommendation systems predict user preferences and suggest relevant content. This covers the three main approaches: collaborative filtering, content-based filtering, and hybrid methods.

---

## Architecture Overview

```
User Actions (Clicks, Likes, Swipes, Messages)
    |
    v
[Event Collection]  <-- Client-side tracking
    |
    v
[Event Pipeline]  <-- Real-time or batch processing
    |
    +--> [Collaborative Filtering]  <-- User-User or Item-Item similarity
    +--> [Content-Based]  <-- Feature matching
    +--> [Embedding Model]  <-- Vector representations
    |
    v
[Ranking Engine]  <-- Combine signals
    |
    v
[Recommendation Cache]  <-- Pre-computed results
    |
    v
[API Response]
```

---

## Data Model

### 1. Core Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_data JSONB,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User actions/interactions
CREATE TABLE user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  target_user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,  -- 'like', 'dislike', 'super_like', 'message', 'view', 'skip'
  action_weight FLOAT DEFAULT 1.0,  -- Positive for likes, negative for dislikes
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User embeddings (for similarity search)
CREATE TABLE user_embeddings (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  embedding vector(384),  -- Profile embedding
  preferences_embedding vector(384),  -- Behavioral embedding
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches/Recommendations cache
CREATE TABLE recommendations (
  user_id UUID REFERENCES users(id),
  recommended_user_id UUID REFERENCES users(id),
  score FLOAT NOT NULL,
  reason TEXT,  -- 'collaborative', 'content', 'hybrid'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, recommended_user_id)
);
```

### 2. Action Weights

```javascript
const ACTION_WEIGHTS = {
  super_like: 2.0,
  like: 1.0,
  message: 0.8,
  view_profile: 0.3,
  match: 1.5,
  dislike: -0.5,
  skip: -0.3,
  block: -2.0,
  unmatch: -1.5,
};
```

---

## Collaborative Filtering

### 1. User-User Similarity

Find users similar to a target user:

```sql
-- Find users with similar interaction patterns
CREATE OR REPLACE FUNCTION find_similar_users(
  target_user_id UUID,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  similarity FLOAT,
  shared_interests INT
)
LANGUAGE SQL STABLE AS $$
  WITH target_actions AS (
    SELECT target_user_id, action_type, target_user_id
    FROM user_actions
    WHERE user_id = target_user_id
      AND action_type IN ('like', 'super_like', 'match')
  ),
  similar_users AS (
    SELECT
      ua.user_id,
      COUNT(*) as shared_interests,
      -- Jaccard similarity
      COUNT(*)::FLOAT / (
        SELECT COUNT(DISTINCT target_user_id)
        FROM user_actions
        WHERE user_id = target_user_id
      ) + (
        SELECT COUNT(DISTINCT target_user_id)
        FROM user_actions
        WHERE ua.user_id = user_id
      ) - COUNT(*))::FLOAT as similarity
    FROM user_actions ua
    WHERE ua.action_type IN ('like', 'super_like', 'match')
      AND ua.user_id != target_user_id
      AND ua.target_user_id IN (
        SELECT target_user_id FROM target_actions
      )
    GROUP BY ua.user_id
  )
  SELECT
    su.user_id,
    su.similarity,
    su.shared_interests
  FROM similar_users su
  ORDER BY su.similarity DESC
  LIMIT match_count;
$$;
```

### 2. Item-Item Similarity (User-Based Recommendations)

```sql
-- Find users who liked the same people as the target user
CREATE OR REPLACE FUNCTION collaborative_recommendations(
  target_user_id UUID,
  match_count INT DEFAULT 20
)
RETURNS TABLE (
  recommended_user_id UUID,
  score FLOAT,
  common_likes INT
)
LANGUAGE SQL STABLE AS $$
  WITH target_liked AS (
    SELECT target_user_id
    FROM user_actions
    WHERE user_id = target_user_id
      AND action_type IN ('like', 'super_like', 'match')
  ),
  similar_users AS (
    SELECT user_id, COUNT(*) as common
    FROM user_actions
    WHERE target_user_id IN (SELECT target_user_id FROM target_liked)
      AND action_type IN ('like', 'super_like', 'match')
      AND user_id != target_user_id
    GROUP BY user_id
    ORDER BY common DESC
    LIMIT 50
  ),
  recommendations AS (
    SELECT
      ua.target_user_id as recommended_user_id,
      COUNT(DISTINCT su.user_id) as common_users,
      AVG(su.common::FLOAT) as avg_common
    FROM similar_users su
    JOIN user_actions ua ON ua.user_id = su.user_id
    WHERE ua.action_type IN ('like', 'super_like', 'match')
      AND ua.target_user_id != target_user_id
      AND ua.target_user_id NOT IN (SELECT target_user_id FROM target_liked)
    GROUP BY ua.target_user_id
  )
  SELECT
    r.recommended_user_id,
    (r.common_users * 0.6 + r.avg_common * 0.4) as score,
    r.common_users as common_likes
  FROM recommendations r
  ORDER BY score DESC
  LIMIT match_count;
$$;
```

---

## Content-Based Filtering

### 1. Profile Embedding Generation

```javascript
import { pipeline } from '@huggingface/transformers';

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

async function generateProfileEmbedding(profile) {
  // Create rich text representation of profile
  const profileText = [
    profile.bio,
    profile.interests?.join(' '),
    profile.location,
    profile.looking_for,
    profile.values?.join(' '),
  ].filter(Boolean).join('. ');

  const output = await extractor(profileText, {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(output.data);
}

// Store embedding
async function storeUserEmbedding(userId, profile) {
  const embedding = await generateProfileEmbedding(profile);

  const { error } = await supabase.from('user_embeddings').upsert({
    user_id: userId,
    embedding: embedding,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
```

### 2. Similarity Search Function

```sql
CREATE OR REPLACE FUNCTION find_similar_profiles(
  query_embedding vector(384),
  target_user_id UUID,
  match_count INT DEFAULT 20,
  match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  user_id UUID,
  similarity FLOAT,
  profile_data JSONB
)
LANGUAGE SQL STABLE AS $$
  SELECT
    ue.user_id,
    1 - (ue.embedding <=> query_embedding) as similarity,
    u.profile_data
  FROM user_embeddings ue
  JOIN users u ON u.id = ue.user_id
  WHERE ue.user_id != target_user_id
    AND 1 - (ue.embedding <=> query_embedding) > match_threshold
    -- Exclude blocked/matched users
    AND ue.user_id NOT IN (
      SELECT target_user_id
      FROM user_actions
      WHERE user_id = target_user_id
        AND action_type IN ('block', 'unmatch')
    )
  ORDER BY ue.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### 3. Feature-Based Matching

```javascript
function calculateFeatureMatchScore(userA, userB) {
  let score = 0;
  let totalWeight = 0;

  // Location proximity
  const distance = calculateDistance(userA.location, userB.location);
  const locationScore = Math.max(0, 1 - distance / 100); // 100km max
  score += locationScore * 0.2;
  totalWeight += 0.2;

  // Age preference
  const ageDiff = Math.abs(userA.age - userB.age);
  const ageScore = ageDiff <= 5 ? 1 : ageDiff <= 10 ? 0.7 : 0.3;
  score += ageScore * 0.15;
  totalWeight += 0.15;

  // Interest overlap
  const commonInterests = userA.interests.filter(i =>
    userB.interests.includes(i)
  ).length;
  const interestScore = commonInterests / Math.max(
    userA.interests.length,
    userB.interests.length
  );
  score += interestScore * 0.3;
  totalWeight += 0.3;

  // Values alignment
  const commonValues = userA.values.filter(v =>
    userB.values.includes(v)
  ).length;
  const valuesScore = commonValues / Math.max(
    userA.values.length,
    userB.values.length
  );
  score += valuesScore * 0.25;
  totalWeight += 0.25;

  // Looking for compatibility
  const lookingForMatch = userA.looking_for.some(l =>
    userB.looking_for.includes(l)
  );
  score += (lookingForMatch ? 1 : 0) * 0.1;
  totalWeight += 0.1;

  return score / totalWeight;
}
```

---

## Hybrid Recommendation System

### 1. Combined Scoring

```javascript
class HybridRecommender {
  constructor() {
    this.weights = {
      collaborative: 0.3,
      content: 0.4,
      feature: 0.2,
      popularity: 0.1,
    };
  }

  async getRecommendations(userId, options = {}) {
    const { limit = 20 } = options;

    // Get scores from each approach
    const [collaborative, content, features, popularity] = await Promise.all([
      this.getCollaborativeScores(userId),
      this.getContentScores(userId),
      this.getFeatureScores(userId),
      this.getPopularityScores(userId),
    ]);

    // Combine scores
    const candidates = new Map();

    for (const [candidateId, score] of collaborative) {
      candidates.set(candidateId, {
        collaborative: score,
        content: 0,
        feature: 0,
        popularity: 0,
      });
    }

    for (const [candidateId, score] of content) {
      if (!candidates.has(candidateId)) {
        candidates.set(candidateId, { collaborative: 0, content: 0, feature: 0, popularity: 0 });
      }
      candidates.get(candidateId).content = score;
    }

    // ... merge other scores

    // Calculate weighted final score
    const results = [];
    for (const [candidateId, scores] of candidates) {
      const finalScore =
        scores.collaborative * this.weights.collaborative +
        scores.content * this.weights.content +
        scores.feature * this.weights.feature +
        scores.popularity * this.weights.popularity;

      results.push({
        userId: candidateId,
        score: finalScore,
        breakdown: scores,
      });
    }

    // Sort by score and return top N
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getCollaborativeScores(userId) {
    const { data } = await supabase.rpc('collaborative_recommendations', {
      target_user_id: userId,
      match_count: 50,
    });

    return new Map(data.map(r => [r.recommended_user_id, r.score]));
  }

  async getContentScores(userId) {
    const user = await getUser(userId);
    const embedding = await generateProfileEmbedding(user);

    const { data } = await supabase.rpc('find_similar_profiles', {
      query_embedding: embedding,
      target_user_id: userId,
      match_count: 50,
      match_threshold: 0.3,
    });

    return new Map(data.map(r => [r.user_id, r.similarity]));
  }

  async getFeatureScores(userId) {
    const user = await getUser(userId);
    const candidates = await getCandidateUsers(userId);

    const scores = new Map();
    for (const candidate of candidates) {
      scores.set(candidate.id, calculateFeatureMatchScore(user, candidate));
    }

    return scores;
  }

  async getPopularityScores(userId) {
    const { data } = await supabase
      .from('user_actions')
      .select('target_user_id, COUNT(*) as likes')
      .eq('action_type', 'like')
      .group('target_user_id')
      .order('likes', { ascending: false })
      .limit(50);

    const maxLikes = data[0]?.likes || 1;
    return new Map(data.map(r => [r.target_user_id, r.likes / maxLikes]));
  }
}
```

---

## Dating App Specific Patterns

### 1. Mutual Interest Detection

```sql
-- Find mutual likes (matches)
CREATE OR REPLACE FUNCTION find_matches(
  user_id UUID,
  match_count INT DEFAULT 50
)
RETURNS TABLE (
  matched_user_id UUID,
  mutual_score FLOAT,
  compatibility_score FLOAT,
  profile_data JSONB
)
LANGUAGE SQL STABLE AS $$
  WITH mutual_likes AS (
    SELECT
      ua1.target_user_id as matched_user_id,
      (ua1.action_weight + ua2.action_weight) / 2 as mutual_score
    FROM user_actions ua1
    JOIN user_actions ua2
      ON ua1.target_user_id = ua2.user_id
      AND ua1.user_id = ua2.target_user_id
    WHERE ua1.user_id = find_matches.user_id
      AND ua1.action_type IN ('like', 'super_like')
      AND ua2.action_type IN ('like', 'super_like')
  )
  SELECT
    ml.matched_user_id,
    ml.mutual_score,
    COALESCE(ue.similarity, 0.5) as compatibility_score,
    u.profile_data
  FROM mutual_likes ml
  LEFT JOIN user_embeddings ue
    ON ue.user_id = ml.matched_user_id
  JOIN users u ON u.id = ml.matched_user_id
  ORDER BY ml.mutual_score * 0.6 + COALESCE(ue.similarity, 0.5) * 0.4 DESC
  LIMIT match_count;
$$;
```

### 2. Swipe Queue Generation

```javascript
async function generateSwipeQueue(userId, count = 50) {
  // Get users not yet seen
  const seenUsers = await getSeenUsers(userId);

  const { data: candidates } = await supabase
    .from('users')
    .select('*')
    .not('id', 'in', `(${seenUsers.join(',')})`)
    .neq('id', userId)
    .limit(count * 3);  // Get extra for filtering

  // Score and rank candidates
  const scored = await Promise.all(
    candidates.map(async (candidate) => {
      const scores = await getMultiSignalScores(userId, candidate.id);
      return { ...candidate, scores };
    })
  );

  // Sort by composite score
  scored.sort((a, b) => {
    const scoreA = Object.values(a.scores).reduce((s, v) => s + v, 0);
    const scoreB = Object.values(b.scores).reduce((s, v) => s + v, 0);
    return scoreB - scoreA;
  });

  return scored.slice(0, count);
}

async function getMultiSignalScores(userId, candidateId) {
  const [profileMatch, interestMatch, activityMatch] = await Promise.all([
    getProfileMatchScore(userId, candidateId),
    getInterestMatchScore(userId, candidateId),
    getActivityScore(candidateId),
  ]);

  return {
    profile: profileMatch,
    interests: interestMatch,
    activity: activityMatch,
    recency: activityMatch,
  };
}
```

### 3. Message Response Prediction

```javascript
// Predict likelihood of getting a response
async function predictResponseRate(userId, candidateId) {
  const features = {
    // User features
    userResponseRate: await getUserResponseRate(userId),
    userAvgMessageLength: await getUserAvgMessageLength(userId),
    userActiveHours: await getUserActiveHours(userId),

    // Candidate features
    candidateResponseRate: await getUserResponseRate(candidateId),
    candidateAvgMessageLength: await getUserAvgMessageLength(candidateId),
    candidateActiveHours: await getUserActiveHours(candidateId),

    // Compatibility features
    interestOverlap: await getInterestOverlap(userId, candidateId),
    messageTimingMatch: await getMessageTimingMatch(userId, candidateId),
    responseTimeSimilarity: await getResponseTimeSimilarity(userId, candidateId),
  };

  // Simple heuristic (replace with trained model)
  const score =
    features.userResponseRate * 0.2 +
    features.candidateResponseRate * 0.2 +
    features.interestOverlap * 0.3 +
    features.messageTimingMatch * 0.15 +
    features.responseTimeSimilarity * 0.15;

  return Math.min(1, Math.max(0, score));
}
```

---

## Real-Time Recommendation API

### 1. Edge Function

```javascript
// supabase/functions/recommendations/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { userId, limit = 20, type = 'discover' } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  let recommendations;

  switch (type) {
    case 'discover':
      // New people to potentially match with
      recommendations = await supabase.rpc('collaborative_recommendations', {
        target_user_id: userId,
        match_count: limit,
      });
      break;

    case 'matches':
      // Mutual matches (already liked each other)
      recommendations = await supabase.rpc('find_matches', {
        user_id: userId,
        match_count: limit,
      });
      break;

    case 'similar':
      // People similar to a specific user
      const { targetUserId } = await req.json();
      const targetUser = await supabase
        .from('user_embeddings')
        .select('embedding')
        .eq('user_id', targetUserId)
        .single();

      recommendations = await supabase.rpc('find_similar_profiles', {
        query_embedding: targetUser.data.embedding,
        target_user_id: userId,
        match_count: limit,
        match_threshold: 0.5,
      });
      break;
  }

  return new Response(JSON.stringify(recommendations.data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 2. Caching Strategy

```javascript
// Cache recommendations in Redis or database
async function getCachedRecommendations(userId, type) {
  const cacheKey = `rec:${userId}:${type}`;

  // Check cache (5 minute TTL)
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Generate fresh recommendations
  const recommendations = await generateRecommendations(userId, type);

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(recommendations));

  return recommendations;
}

// Invalidate cache on user action
async function onUserAction(userId, action, targetUserId) {
  // Invalidate cache for both users
  await redis.del(`rec:${userId}:discover`);
  await redis.del(`rec:${userId}:matches`);
  await redis.del(`rec:${targetUserId}:discover`);
  await redis.del(`rec:${targetUserId}:matches`);

  // Update action weights
  await recordAction(userId, action, targetUserId);
}
```

---

## Performance Optimization

### 1. Batch Processing

```javascript
// Generate recommendations in batches
async function batchGenerateRecommendations(userIds, batchSize = 100) {
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (userId) => {
        try {
          const recommendations = await generateRecommendations(userId);
          await cacheRecommendations(userId, recommendations);
        } catch (error) {
          console.error(`Failed for user ${userId}:`, error);
        }
      })
    );

    // Small delay between batches
    await new Promise(r => setTimeout(r, 100));
  }
}
```

### 2. Pre-computed Embeddings

```javascript
// Update embeddings periodically
async function updateEmbeddings(userIds) {
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  for (const userId of userIds) {
    const user = await getUser(userId);
    const embedding = await generateProfileEmbedding(user, extractor);

    await supabase.from('user_embeddings').upsert({
      user_id: userId,
      embedding,
      updated_at: new Date().toISOString(),
    });
  }
}
```

---

## Metrics and Monitoring

### 1. Track Recommendation Quality

```sql
CREATE TABLE recommendation_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  recommendation_type TEXT,
  recommended_user_id UUID,
  was_recommended BOOLEAN,
  was_viewed BOOLEAN,
  was_liked BOOLEAN,
  was_messaged BOOLEAN,
  was_matched BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calculate key metrics
SELECT
  recommendation_type,
  COUNT(*) as total_recommendations,
  AVG(CASE WHEN was_viewed THEN 1 ELSE 0 END) as view_rate,
  AVG(CASE WHEN was_liked THEN 1 ELSE 0 END) as like_rate,
  AVG(CASE WHEN was_messaged THEN 1 ELSE 0 END) as message_rate,
  AVG(CASE WHEN was_matched THEN 1 ELSE 0 END) as match_rate
FROM recommendation_metrics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY recommendation_type;
```

---

## Deployment Checklist

1. **Start simple:** Content-based filtering first, then add collaborative
2. **Collect data:** Track all user interactions
3. **Generate embeddings:** Use Transformers.js for profile embeddings
4. **Implement caching:** Pre-compute and cache recommendations
5. **A/B test:** Compare different algorithms and weights
6. **Monitor metrics:** Track view, like, and match rates
7. **Iterate:** Use feedback to improve algorithms

---

## Quick Reference

```javascript
// Content-based search
const results = await supabase.rpc('find_similar_profiles', {
  query_embedding: embedding,
  target_user_id: userId,
  match_count: 20,
  match_threshold: 0.5,
});

// Collaborative filtering
const results = await supabase.rpc('collaborative_recommendations', {
  target_user_id: userId,
  match_count: 20,
});

// Mutual matches
const results = await supabase.rpc('find_matches', {
  user_id: userId,
  match_count: 20,
});
```
