/**
 * App Stores — Canonical Zustand stores, professional naming, DRY, KISS
 * Hexagonal: domain defines state, adapters persist
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// App Config
type AppConfigState = {
  discreetIcon: string;
  discreetEnabled: boolean;
  appLockEnabled: boolean;
  appLockPinHash: string | null;
  appLockBiometric: boolean;
  appLockTimeoutSec: number;
  pauseMode: { enabled: boolean; resumeAt?: string } | null;
  widgetConfig: Record<string, unknown>;
  setDiscreetIcon: (icon: string) => void;
  setDiscreetEnabled: (enabled: boolean) => void;
  setAppLock: (config: Partial<AppConfigState>) => void;
  setPauseMode: (mode: AppConfigState["pauseMode"]) => void;
  setWidgetConfig: (config: Record<string, unknown>) => void;
  isPaused: () => boolean;
  shouldLock: (lastActiveAt: string) => boolean;
};

export const useAppConfigStore = create<AppConfigState>()(
  persist(
    (set, get) => ({
      discreetIcon: "default",
      discreetEnabled: false,
      appLockEnabled: false,
      appLockPinHash: null,
      appLockBiometric: false,
      appLockTimeoutSec: 60,
      pauseMode: null,
      widgetConfig: {
        enabled: true,
        showMatches: true,
        showUnread: true,
        showLikes: true,
        showFeatured: true,
        refreshIntervalMinutes: 15,
      },
      setDiscreetIcon: (icon) => set({ discreetIcon: icon }),
      setDiscreetEnabled: (enabled) => set({ discreetEnabled: enabled }),
      setAppLock: (config) => set((s) => ({ ...s, ...config })),
      setPauseMode: (mode) => set({ pauseMode: mode }),
      setWidgetConfig: (config) => set({ widgetConfig: config }),
      isPaused: () => {
        const mode = get().pauseMode;
        if (!mode?.enabled) return false;
        if (!mode.resumeAt) return true;
        return new Date(mode.resumeAt).getTime() > Date.now();
      },
      shouldLock: (lastActiveAt) => {
        if (!get().appLockEnabled) return false;
        const elapsed = Date.now() - new Date(lastActiveAt).getTime();
        return elapsed > get().appLockTimeoutSec * 1000;
      },
    }),
    { name: "app-config-store" },
  ),
);

// Multi-Account — max 5, LRU
type MultiAccountState = {
  accounts: Array<{ accountId: string; email: string; displayName: string; lastUsedAt: string }>;
  currentAccountId: string | null;
  addAccount: (account: MultiAccountState["accounts"][0]) => { success: boolean; error?: string };
  removeAccount: (accountId: string) => void;
  switchAccount: (accountId: string) => MultiAccountState["accounts"][0] | null;
  getCurrentAccount: () => MultiAccountState["accounts"][0] | null;
};

export const useMultiAccountStore = create<MultiAccountState>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentAccountId: null,
      addAccount: (account) => {
        const accounts = get().accounts;
        if (accounts.length >= 5) return { success: false, error: "Max 5 accounts" };
        if (accounts.some((a) => a.accountId === account.accountId)) return { success: false, error: "Already exists" };
        set({ accounts: [...accounts, account], currentAccountId: account.accountId });
        return { success: true };
      },
      removeAccount: (accountId) =>
        set((s) => ({
          accounts: s.accounts.filter((a) => a.accountId !== accountId),
          currentAccountId: s.currentAccountId === accountId ? (s.accounts[0]?.accountId ?? null) : s.currentAccountId,
        })),
      switchAccount: (accountId) => {
        const account = get().accounts.find((a) => a.accountId === accountId);
        if (account) set({ currentAccountId: accountId });
        return account ?? null;
      },
      getCurrentAccount: () => {
        const { accounts, currentAccountId } = get();
        return accounts.find((a) => a.accountId === currentAccountId) ?? null;
      },
    }),
    { name: "multi-account-store" },
  ),
);

// Generic list store factory — DRY (kept for extensibility, used via scheduled store explicit impl)
export function createListStore<T extends { id: string }>(name: string) {
  type State = {
    items: T[];
    add: (item: T) => void;
    remove: (id: string) => void;
    update: (id: string, updates: Partial<T>) => void;
    getById: (id: string) => T | null;
    getAll: () => T[];
  };
  return create<State>()(
    persist(
      (set, get) => ({
        items: [],
        add: (item) => set((s) => ({ items: [...s.items, item] })),
        remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
        update: (id, updates) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
        getById: (id) => get().items.find((i) => i.id === id) ?? null,
        getAll: () => get().items,
      }),
      { name },
    ),
  );
}

// Scheduled — conversationId, status, scheduledAt are required for scheduling
type ScheduledItem = { id: string; conversationId: string; status: string; scheduledAt: string; body?: string; senderId?: string; type?: string; createdAt?: string };
export const useScheduledStore = create<{
  items: ScheduledItem[];
  add: (item: ScheduledItem) => void;
  remove: (id: string) => void;
  update: (id: string, updates: Partial<ScheduledItem>) => void;
  getById: (id: string) => ScheduledItem | null;
  getAll: () => ScheduledItem[];
  getDue: () => ScheduledItem[];
  getByConversation: (conversationId: string) => ScheduledItem[];
}>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      update: (id, updates) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
      getById: (id) => get().items.find((i) => i.id === id) ?? null,
      getAll: () => get().items,
      getDue: () => get().items.filter((m) => m.status === "scheduled" && new Date(m.scheduledAt).getTime() <= Date.now()),
      getByConversation: (conversationId) => get().items.filter((m) => m.conversationId === conversationId),
    }),
    { name: "scheduled-store" },
  ),
);

// Wishlist — with participantId and ownerId for lookup
type WishlistItem = { id: string; votes: string[]; voteCount: number; text?: string; category?: string; addedBy?: string; createdAt?: string };
type Wishlist = { id: string; participantId?: string; ownerId?: string; items?: WishlistItem[] };
export const useWishlistStore = create<{
  wishlists: Wishlist[];
  addWishlist: (wishlist: Wishlist) => void;
  addItem: (wishlistId: string, item: { id: string }) => void;
  voteItem: (wishlistId: string, itemId: string, userId: string) => void;
  getTopItems: (wishlistId: string) => WishlistItem[];
}>()(
  persist(
    (set, get) => ({
      wishlists: [],
      addWishlist: (wishlist) => set((s) => ({ wishlists: [...s.wishlists, wishlist] })),
      addItem: (wishlistId, item) =>
        set((s) => ({
          wishlists: s.wishlists.map((w) => (w.id === wishlistId ? { ...w, items: [...(w.items ?? []), item as never] } : w)),
        })),
      voteItem: (wishlistId, itemId, userId) =>
        set((s) => ({
          wishlists: s.wishlists.map((w) => {
            if (w.id !== wishlistId) return w;
            return {
              ...w,
              items: (w.items ?? []).map((it) => {
                if (it.id !== itemId) return it;
                const votes = it.votes.includes(userId) ? it.votes.filter((v) => v !== userId) : [...it.votes, userId];
                return { ...it, votes, voteCount: votes.length };
              }),
            };
          }),
        })),
      getTopItems: (wishlistId) => {
        const wishlist = get().wishlists.find((w) => w.id === wishlistId);
        if (!wishlist) return [];
        return [...(wishlist.items ?? [])].sort((a, b) => b.voteCount - a.voteCount).slice(0, 5);
      },
    }),
    { name: "wishlist-store" },
  ),
);

// Photo Scores
export const usePhotoScoreStore = create<{
  scores: Array<{ url: string; appeal: number }>;
  enhancements: Array<{ originalUrl: string }>;
  addScore: (score: { url: string; appeal: number }) => void;
  addEnhancement: (enh: { originalUrl: string }) => void;
  getTopPhotos: () => Array<{ url: string; appeal: number }>;
  getAverageAppeal: () => number;
}>()(
  persist(
    (set, get) => ({
      scores: [],
      enhancements: [],
      addScore: (score) => set((s) => ({ scores: [...s.scores, score] })),
      addEnhancement: (enh) => set((s) => ({ enhancements: [...s.enhancements, enh] })),
      getTopPhotos: () => [...get().scores].sort((a, b) => b.appeal - a.appeal),
      getAverageAppeal: () => {
        const scores = get().scores;
        if (scores.length === 0) return 0;
        return scores.reduce((sum, s) => sum + s.appeal, 0) / scores.length;
      },
    }),
    { name: "photo-score-store" },
  ),
);

// AI
export const useAIStore = create<{
  conversations: Array<{ id: string; type: string }>;
  usage: Record<string, number>;
  suggestions: Array<{ id: string; selectedIndex?: number; selectedAt?: string }>;
  addConversation: (convo: { id: string; type: string }) => void;
  addSuggestion: (sug: { id: string }) => void;
  selectSuggestion: (id: string, index: number) => void;
  getUsage: (feature: string) => number;
  canUseFeature: (feature: string, limit: number) => boolean;
}>()(
  persist(
    (set, get) => ({
      conversations: [],
      usage: {},
      suggestions: [],
      addConversation: (convo) =>
        set((s) => ({
          conversations: [...s.conversations, convo],
          usage: { ...s.usage, [convo.type]: (s.usage[convo.type] ?? 0) + 1 },
        })),
      addSuggestion: (sug) => set((s) => ({ suggestions: [...s.suggestions, sug] })),
      selectSuggestion: (id, index) =>
        set((s) => ({
          suggestions: s.suggestions.map((sug) => (sug.id === id ? { ...sug, selectedIndex: index, selectedAt: new Date().toISOString() } : sug)),
        })),
      getUsage: (feature) => get().usage[feature] ?? 0,
      canUseFeature: (feature, limit) => (get().usage[feature] ?? 0) < limit,
    }),
    { name: "ai-store" },
  ),
);

// Chat Enhancements
export const useChatEnhStore = create<{
  pinned: Array<{ conversationId: string; messageId: string }>;
  ephemeral: Record<string, unknown>;
  screenshotLogs: Array<{ id: string; conversationId?: string; platform?: string }>;
  pinMessage: (pin: { conversationId: string; messageId: string }) => void;
  unpinMessage: (conversationId: string, messageId: string) => void;
  setEphemeral: (conversationId: string, settings: unknown) => void;
  logScreenshot: (log: { id: string; conversationId?: string; platform?: string }) => void;
  getPinned: (conversationId: string) => Array<{ conversationId: string; messageId: string }>;
}>()(
  persist(
    (set, get) => ({
      pinned: [],
      ephemeral: {},
      screenshotLogs: [],
      pinMessage: (pin) => set((s) => ({ pinned: [...s.pinned, pin] })),
      unpinMessage: (conversationId, messageId) =>
        set((s) => ({ pinned: s.pinned.filter((p) => !(p.conversationId === conversationId && p.messageId === messageId)) })),
      setEphemeral: (conversationId, settings) => set((s) => ({ ephemeral: { ...s.ephemeral, [conversationId]: settings } })),
      logScreenshot: (log) => set((s) => ({ screenshotLogs: [...s.screenshotLogs, log] })),
      getPinned: (conversationId) => get().pinned.filter((p) => p.conversationId === conversationId),
    }),
    { name: "chat-enh-store" },
  ),
);

// Speed Dating
export const useSpeedDatingStore = create<{
  events: Array<{ id: string }>;
  participations: Array<{ id: string; eventId: string; userId: string; round: number }>;
  joinEvent: (eventId: string, userId: string) => void;
  leaveEvent: (eventId: string, userId: string) => void;
  nextRound: (eventId: string) => void;
  getEvent: (eventId: string) => { id: string } | null;
}>()(
  persist(
    (set, get) => ({
      events: [],
      participations: [],
      joinEvent: (eventId, userId) =>
        set((s) => ({
          participations: [
            ...s.participations,
            { id: crypto.randomUUID(), eventId, userId, round: 1, status: "waiting", joinedAt: new Date().toISOString() } as never,
          ],
        })),
      leaveEvent: (eventId, userId) => set((s) => ({ participations: s.participations.filter((p) => !(p.eventId === eventId && p.userId === userId)) })),
      nextRound: (eventId) => set((s) => ({ participations: s.participations.map((p) => (p.eventId === eventId ? { ...p, round: p.round + 1 } : p)) })),
      getEvent: (eventId) => get().events.find((e) => e.id === eventId) ?? null,
    }),
    { name: "speed-dating-store" },
  ),
);

// Calendar
export const useCalendarStore = create<{
  sync: { freeSlots?: unknown[] } | null;
  events: Array<{ id: string; startsAt: string }>;
  setSync: (sync: { freeSlots?: unknown[] } | null) => void;
  addEvent: (event: { id: string; startsAt: string }) => void;
  removeEvent: (id: string) => void;
  getUpcoming: () => Array<{ id: string; startsAt: string }>;
  getFreeSlots: () => unknown[];
}>()(
  persist(
    (set, get) => ({
      sync: null,
      events: [],
      setSync: (sync) => set({ sync }),
      addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      getUpcoming: () =>
        get()
          .events.filter((e) => new Date(e.startsAt).getTime() > Date.now())
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
      getFreeSlots: () => get().sync?.freeSlots ?? [],
    }),
    { name: "calendar-store" },
  ),
);

// Stats
export const useStatsStore = create<{
  stats: { replyRate?: number; bestPhotoUrl?: string | null } | null;
  analyticsEvents: Array<{ id: string }>;
  setStats: (stats: { replyRate?: number; bestPhotoUrl?: string | null } | null) => void;
  addEvent: (event: { id: string }) => void;
  getReplyRate: () => number;
  getBestPhoto: () => string | null;
}>()(
  persist(
    (set, get) => ({
      stats: null,
      analyticsEvents: [],
      setStats: (stats) => set({ stats }),
      addEvent: (event) => set((s) => ({ analyticsEvents: [...s.analyticsEvents, event] })),
      getReplyRate: () => get().stats?.replyRate ?? 0,
      getBestPhoto: () => get().stats?.bestPhotoUrl ?? null,
    }),
    { name: "stats-store" },
  ),
);

// Consumables
export const useConsumablesStore = create<{
  catalog: Array<{ sku: string }>;
  inventory: Record<string, number>;
  purchase: (sku: string, quantity: number) => void;
  consume: (sku: string) => boolean;
  getBalance: (type: string) => number;
}>()(
  persist(
    (set, get) => ({
      catalog: [],
      inventory: {},
      purchase: (sku, quantity) => set((s) => ({ inventory: { ...s.inventory, [sku]: (s.inventory[sku] ?? 0) + quantity } })),
      consume: (sku) => {
        const current = get().inventory[sku] ?? 0;
        if (current <= 0) return false;
        set((s) => ({ inventory: { ...s.inventory, [sku]: current - 1 } }));
        return true;
      },
      getBalance: (type) => {
        const inv = get().inventory;
        return Object.entries(inv)
          .filter(([sku]) => sku.includes(type))
          .reduce((sum, [, qty]) => sum + (qty as number), 0);
      },
    }),
    { name: "consumables-store" },
  ),
);

// Grid Presets
export const useGridPresetsStore = create<{
  presets: Array<{ id: string; isQuick: boolean }>;
  addPreset: (preset: { id: string; isQuick: boolean }) => void;
  removePreset: (id: string) => void;
  getQuickPresets: () => Array<{ id: string; isQuick: boolean }>;
  getSavedPresets: () => Array<{ id: string; isQuick: boolean }>;
}>()(
  persist(
    (set, get) => ({
      presets: [],
      addPreset: (preset) => set((s) => ({ presets: [...s.presets, preset] })),
      removePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
      getQuickPresets: () => get().presets.filter((p) => p.isQuick),
      getSavedPresets: () => get().presets.filter((p) => !p.isQuick),
    }),
    { name: "grid-presets-store" },
  ),
);

// Compatibility
export const useCompatStore = create<{
  scores: Array<{ userA: string; userB: string; score: number }>;
  secretAdmirers: Array<{ id: string; revealed: boolean; revealedAt?: string }>;
  setScore: (score: { userA: string; userB: string; score: number }) => void;
  addSecretAdmirer: (admirer: { id: string; revealed: boolean }) => void;
  revealAdmirer: (id: string) => void;
  getScore: (userA: string, userB: string) => { userA: string; userB: string; score: number } | null;
}>()(
  persist(
    (set, get) => ({
      scores: [],
      secretAdmirers: [],
      setScore: (score) =>
        set((s) => {
          const idx = s.scores.findIndex((sc) => (sc.userA === score.userA && sc.userB === score.userB) || (sc.userA === score.userB && sc.userB === score.userA));
          if (idx >= 0) {
            const next = [...s.scores];
            next[idx] = score;
            return { scores: next };
          }
          return { scores: [...s.scores, score] };
        }),
      addSecretAdmirer: (admirer) => set((s) => ({ secretAdmirers: [...s.secretAdmirers, admirer] })),
      revealAdmirer: (id) => set((s) => ({ secretAdmirers: s.secretAdmirers.map((a) => (a.id === id ? { ...a, revealed: true, revealedAt: new Date().toISOString() } : a)) })),
      getScore: (userA, userB) => get().scores.find((sc) => (sc.userA === userA && sc.userB === userB) || (sc.userA === userB && sc.userB === userA)) ?? null,
    }),
    { name: "compat-store" },
  ),
);

// Safety
export const useSafetyStore = create<{
  emergencyShares: Array<{ id: string }>;
  deletionRequest: { id: string } | null;
  shareEmergency: (share: { id: string }) => void;
  requestDeletion: (request: { id: string }) => void;
  cancelDeletion: () => void;
}>()(
  persist(
    (set) => ({
      emergencyShares: [],
      deletionRequest: null,
      shareEmergency: (share) => set((s) => ({ emergencyShares: [...s.emergencyShares, share] })),
      requestDeletion: (request) => set({ deletionRequest: request }),
      cancelDeletion: () => set({ deletionRequest: null }),
    }),
    { name: "safety-store" },
  ),
);

// Offline Queue
export const useOfflineQueueStore = create<{
  queue: Array<{ id: string; action: string; payload: unknown; attempts: number; status: string; createdAt: string }>;
  enqueue: (action: string, payload: unknown) => void;
  dequeue: (id: string) => void;
  markDone: (id: string) => void;
  markFailed: (id: string) => void;
  getPending: () => Array<{ id: string; status: string }>;
  flush: () => Promise<void>;
}>()(
  persist(
    (set, get) => ({
      queue: [],
      enqueue: (action, payload) =>
        set((s) => ({
          queue: [...s.queue, { id: crypto.randomUUID(), action, payload, attempts: 0, status: "pending", createdAt: new Date().toISOString() }],
        })),
      dequeue: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
      markDone: (id) => set((s) => ({ queue: s.queue.map((q) => (q.id === id ? { ...q, status: "done" } : q)) })),
      markFailed: (id) => set((s) => ({ queue: s.queue.map((q) => (q.id === id ? { ...q, status: "failed", attempts: q.attempts + 1 } : q)) })),
      getPending: () => get().queue.filter((q) => q.status === "pending"),
      flush: async () => {
        const pending = get().getPending();
        for (const item of pending) {
          try {
            get().markDone(item.id);
          } catch {
            get().markFailed(item.id);
          }
        }
      },
    }),
    { name: "offline-queue-store" },
  ),
);
