/**
 * Canonical Routes — Single source of truth for all API and UI paths
 * Hexagonal architecture: domain defines ports, adapters implement
 */

export const ROUTES = {
  auth: {
    me: "/api/auth/me",
    phone: "/api/auth/phone",
    social: "/api/auth/social",
    twoFactor: "/api/auth/2fa",
    sessions: "/api/auth/sessions",
  },
  profile: {
    self: "/api/profile",
    byId: "/api/profile/$profileId",
    verification: "/api/profile/verification",
    socialLinks: "/api/profile/social-links",
    stats: "/api/profile/stats",
    hotPics: "/api/profile/hot-pics",
    wishlist: "/api/profile/wishlist",
    pause: "/api/profile/pause",
    appConfig: "/api/profile/app-config",
    multiAccount: "/api/profile/multi-account",
    privacyReport: "/api/profile/privacy-report",
    export: "/api/profile/export",
    deletion: "/api/profile/deletion",
  },
  discover: {
    index: "/api/discover",
    fresh: "/api/discover/fresh",
    online: "/api/discover/online",
    places: "/api/discover/places",
    travel: "/api/discover/travel",
    compatibility: "/api/discover/compatibility",
    gridPresets: "/api/discover/grid-presets",
    savedSearches: "/api/discover/saved-searches",
  },
  social: {
    taps: "/api/taps",
    favorites: "/api/interest/favourite",
    likes: "/api/interest/like",
    blocks: "/api/social",
    hides: "/api/settings/hidden",
    reports: "/api/safety/reports",
  },
  chat: {
    conversations: "/api/conversations",
    messages: "/api/conversations/$conversationId/messages",
    reactions: "/api/messages/$messageId/react",
    polls: "/api/chat/polls",
    pollVotes: "/api/chat/polls/vote",
    location: "/api/chat/location",
    themes: "/api/chat/themes",
    quietHours: "/api/chat/quiet-hours",
    scheduled: "/api/chat/scheduled",
    pinned: "/api/chat/pinned",
    ephemeral: "/api/chat/ephemeral",
    screenshot: "/api/chat/screenshot",
    rewarded: "/api/chat/rewarded",
    broadcast: "/api/chat/broadcast",
  },
  matches: {
    likesYou: "/api/matches/likes-you",
    dailyPicks: "/api/matches/daily-picks",
    dealbreakers: "/api/matches/dealbreakers",
    compatibility: "/api/matches/compatibility",
    secretAdmirer: "/api/matches/secret-admirer",
  },
  content: {
    stories: "/api/stories",
    live: "/api/live",
    gifts: "/api/gifts",
    albums: "/api/albums",
    blog: "/api/blog",
    banners: "/api/banners",
    events: "/api/events",
  },
  realtime: {
    calls: "/api/calls",
    roulette: "/api/video-roulette",
    meetnow: "/api/meetnow",
    push: "/api/push/subscribe",
  },
  monetization: {
    wallet: "/api/wallet",
    boost: "/api/boost",
    spotlight: "/api/monetization/spotlight",
    referral: "/api/monetization/referral",
    giftMembership: "/api/monetization/gift-membership",
    payPerRead: "/api/monetization/pay-per-read",
    consumables: "/api/monetization/consumables",
    promo: "/api/monetization/promo",
  },
  safety: {
    contacts: "/api/safety/contacts",
    checkIn: "/api/safety/check-in",
    reports: "/api/safety/reports",
    appeals: "/api/safety/appeals",
    twoFactor: "/api/safety/2fa",
    emergencyShare: "/api/safety/emergency-share",
    rateLimit: "/api/safety/rate-limit",
  },
  ai: {
    core: "/api/ai",
    autoReply: "/api/ai/auto-reply",
    contextReplies: "/api/ai/context-replies",
    datePlanner: "/api/ai/date-planner",
    rizzMeter: "/api/ai/rizz-meter",
    trustScore: "/api/ai/trust-score",
    catfish: "/api/ai/catfish",
    bestTime: "/api/ai/best-time",
    escalation: "/api/ai/escalation",
    wingman: "/api/ai/wingman",
    digest: "/api/ai/digest",
    photoEnhance: "/api/ai/photo-enhance",
    translation: "/api/ai/translation",
    autocomplete: "/api/ai/autocomplete",
    memeSuggest: "/api/ai/meme-suggest",
    voiceNote: "/api/ai/voice-note",
    chatSummary: "/api/ai/chat-summary",
    icebreakers: "/api/ai/icebreakers",
    pickupLines: "/api/ai/pickup-lines",
  },
  growth: {
    completion: "/api/growth/completion",
    streak: "/api/growth/streak",
    engagement: "/api/growth/engagement",
    funnel: "/api/growth/funnel",
  },
  platform: {
    backup: "/api/offline/backup",
    queue: "/api/offline/queue",
    calendar: "/api/calendar",
    speedDating: "/api/speed-dating",
    health: "/api/health",
    notifications: "/api/notifications",
  },
} as const;

export const DEDUPLICATION_MAP: Record<string, string> = {
  "/api/profile/analytics": "/api/profile/stats",
  "/api/search/saved": "/api/discover/saved-searches",
  "/api/search/global": "/api/discover",
  "/api/safety/deletion": "/api/profile/deletion",
  "/api/monetization/voucher": "/api/monetization/promo",
};

export type RouteGroup = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteGroup][keyof (typeof ROUTES)[RouteGroup]];

export function isCanonical(path: string): boolean {
  return !Object.keys(DEDUPLICATION_MAP).includes(path);
}

export function getCanonical(path: string): string {
  return DEDUPLICATION_MAP[path] ?? path;
}

export function getAllPaths(): string[] {
  const paths: string[] = [];
  for (const group of Object.values(ROUTES)) {
    for (const p of Object.values(group)) {
      paths.push(p as string);
    }
  }
  return paths;
}
