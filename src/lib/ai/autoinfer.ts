/**
 * AutoInfer — MAX AUTOMATION — Zenith
 * Auto-infer user preferences, patterns, behavior, predictive
 */

export interface UserPreferences {
  interests: string[];
  lookingFor: string[];
  communicationStyle: 'casual' | 'formal' | 'flirty' | 'direct';
  activityTimes: number[]; // hours 0-23
  responseTimeAvg: number; // minutes
  preferredDistance: number;
  language: string;
}

export async function autoInferPreferences(userId: string): Promise<UserPreferences> {
  // Fetch user activity, messages, profile views, etc.
  const [profileRes, messagesRes, viewsRes] = await Promise.all([
    fetch(`/api/profiles/${userId}`).then(r => r.json().catch(() => ({}))),
    fetch(`/api/messages?userId=${userId}&limit=100`).then(r => r.json().catch(() => ({ messages: [] }))),
    fetch(`/api/profile-views?userId=${userId}`).then(r => r.json().catch(() => ({ views: [] }))),
  ]);

  const messages = messagesRes.messages || [];
  const views = viewsRes.views || [];

  // Infer interests from profile views and messages
  const interestCounts: Record<string, number> = {};
  for (const view of views) {
    for (const tag of view.tags || []) {
      interestCounts[tag] = (interestCounts[tag] || 0) + 1;
    }
  }

  const interests = Object.entries(interestCounts).sort((a,b) => b[1]-a[1]).slice(0,10).map(([k]) => k);

  // Infer communication style from messages
  const avgLength = messages.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0) / (messages.length || 1);
  let communicationStyle: UserPreferences['communicationStyle'] = 'casual';
  if (avgLength > 200) communicationStyle = 'formal';
  else if (messages.some((m: any) => /😍|😘|❤️|🔥/.test(m.content))) communicationStyle = 'flirty';
  else if (avgLength < 50) communicationStyle = 'direct';

  // Infer activity times
  const hourCounts: Record<number, number> = {};
  for (const msg of messages) {
    const hour = new Date(msg.createdAt).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  const activityTimes = Object.entries(hourCounts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([h]) => parseInt(h));

  // Infer response time
  let totalResponseTime = 0;
  let responseCount = 0;
  for (let i = 1; i < messages.length; i++) {
    const prev = new Date(messages[i-1].createdAt).getTime();
    const curr = new Date(messages[i].createdAt).getTime();
    const diff = (curr - prev) / (1000*60); // minutes
    if (diff < 60*24) { // within 24h
      totalResponseTime += diff;
      responseCount++;
    }
  }
  const responseTimeAvg = responseCount > 0 ? totalResponseTime / responseCount : 60;

  return {
    interests,
    lookingFor: profileRes.lookingFor || ['chat', 'dates'],
    communicationStyle,
    activityTimes,
    responseTimeAvg,
    preferredDistance: profileRes.maxDistance || 5000,
    language: profileRes.language || 'en',
  };
}

export async function autoInferNextAction(userId: string, context: { currentView: string; recentActions: string[] }): Promise<{ action: string; confidence: number; reason: string }> {
  const prefs = await autoInferPreferences(userId);
  
  // Predictive: based on activity times, suggest action
  const nowHour = new Date().getHours();
  const isActiveTime = prefs.activityTimes.includes(nowHour);
  
  if (context.currentView === 'nearby' && isActiveTime) {
    return { action: 'boost', confidence: 0.85, reason: `User active at ${nowHour}:00, auto-infer boost to increase visibility` };
  }

  if (context.recentActions.includes('view_profile') && prefs.communicationStyle === 'flirty') {
    return { action: 'send_icebreaker', confidence: 0.8, reason: `Flirty style + profile view, auto-infer icebreaker` };
  }

  if (context.recentActions.includes('message_received') && prefs.responseTimeAvg < 10) {
    return { action: 'quick_reply', confidence: 0.9, reason: `Fast responder avg ${Math.round(prefs.responseTimeAvg)}min, auto-infer quick reply` };
  }

  return { action: 'explore', confidence: 0.5, reason: 'General exploration' };
}

export function autoInferCompatibility(profileA: any, profileB: any): { score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  // Interests Jaccard
  const interestsA = new Set(profileA.tags || []);
  const interestsB = new Set(profileB.tags || []);
  const intersection = [...interestsA].filter(x => interestsB.has(x)).length;
  const union = new Set([...interestsA, ...interestsB]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  score += jaccard * 0.3;
  if (jaccard > 0.5) factors.push(`High interest overlap ${Math.round(jaccard*100)}%`);

  // Age proximity
  const ageDiff = Math.abs((profileA.age || 25) - (profileB.age || 25));
  const ageScore = Math.max(0, 1 - ageDiff/20);
  score += ageScore * 0.2;
  if (ageScore > 0.8) factors.push('Similar age');

  // Distance
  const distance = profileB.distance || 1000;
  const distanceScore = Math.max(0, 1 - distance/10000);
  score += distanceScore * 0.2;
  if (distance < 1000) factors.push('Very close');

  // LookingFor match
  const lookingA = new Set(profileA.lookingFor || []);
  const lookingB = new Set(profileB.lookingFor || []);
  const lookingMatch = [...lookingA].filter(x => lookingB.has(x)).length > 0;
  if (lookingMatch) {
    score += 0.15;
    factors.push('Matching lookingFor');
  }

  // Verified
  if (profileA.verified && profileB.verified) {
    score += 0.15;
    factors.push('Both verified');
  }

  return { score: Math.min(1, score), factors };
}
