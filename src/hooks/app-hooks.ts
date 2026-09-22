/**
 * App Hooks — Canonical React hooks, professional naming, DRY
 * Hexagonal: hooks consume stores (ports), components consume hooks
 */

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  useAppConfigStore,
  useMultiAccountStore,
  useWishlistStore,
  usePhotoScoreStore,
  useAIStore,
  useChatEnhStore,
  useSpeedDatingStore,
  useCalendarStore,
  useStatsStore,
  useConsumablesStore,
  useGridPresetsStore,
  useCompatStore,
  useSafetyStore,
  useOfflineQueueStore,
  useScheduledStore,
} from "#/lib/stores/app-stores";

export function useAppConfig() {
  const store = useAppConfigStore();
  const [isLocked, setIsLocked] = useState(false);
  const [lastActive, setLastActive] = useState(new Date().toISOString());

  const checkLock = useCallback(() => {
    if (store.shouldLock(lastActive)) setIsLocked(true);
  }, [store, lastActive]);

  useEffect(() => {
    const interval = setInterval(checkLock, 10000);
    return () => clearInterval(interval);
  }, [checkLock]);

  const unlock = useCallback(
    (_pin: string) => {
      if (store.appLockPinHash) {
        setIsLocked(false);
        setLastActive(new Date().toISOString());
        return true;
      }
      return false;
    },
    [store.appLockPinHash],
  );

  return { ...store, isLocked, unlock, setLastActive, checkLock };
}

export function useMultiAccount() {
  const store = useMultiAccountStore();
  const [switching, setSwitching] = useState(false);

  const switchAccount = useCallback(
    async (accountId: string) => {
      setSwitching(true);
      try {
        return store.switchAccount(accountId);
      } finally {
        setSwitching(false);
      }
    },
    [store],
  );

  return { ...store, switching, switchAccount };
}

export function useScheduledMessages(conversationId?: string) {
  const store = useScheduledStore();
  const [loading, setLoading] = useState(false);

  const scheduled = useMemo(() => {
    if (conversationId) return store.getByConversation(conversationId);
    return store.items;
  }, [conversationId, store]);

  const due = useMemo(() => store.getDue(), [store]);

  const scheduleMessage = useCallback(
    async (data: { conversationId: string; body: string; scheduledAt: string; type?: string }) => {
      setLoading(true);
      try {
        const msg = {
          id: crypto.randomUUID(),
          conversationId: data.conversationId,
          senderId: "current-user",
          body: data.body,
          type: data.type ?? "text",
          scheduledAt: data.scheduledAt,
          status: "scheduled" as const,
          createdAt: new Date().toISOString(),
        };
        store.add(msg);
        return msg;
      } finally {
        setLoading(false);
      }
    },
    [store],
  );

  return { scheduled, due, loading, scheduleMessage, remove: store.remove, update: store.update };
}

export function useWishlist(participantId?: string) {
  const store = useWishlistStore();
  const wishlist = useMemo(() => {
    if (!participantId) return null;
    return store.wishlists.find((w) => w.participantId === participantId || w.ownerId === participantId) ?? null;
  }, [store.wishlists, participantId]);

  const topItems = useMemo(() => {
    if (!wishlist) return [];
    return store.getTopItems(wishlist.id);
  }, [wishlist, store]);

  const addItem = useCallback(
    async (text: string, category = "general") => {
      if (!wishlist) return null;
      const item = {
        id: crypto.randomUUID(),
        wishlistId: wishlist.id,
        text,
        category,
        addedBy: "current-user",
        votes: [] as string[],
        voteCount: 0,
        createdAt: new Date().toISOString(),
      };
      store.addItem(wishlist.id, item as never);
      return item;
    },
    [wishlist, store],
  );

  return { wishlist, topItems, addItem, voteItem: store.voteItem };
}

export function usePhotoScores() {
  const store = usePhotoScoreStore();
  const topPhotos = useMemo(() => store.getTopPhotos(), [store]);
  const averageAppeal = useMemo(() => store.getAverageAppeal(), [store]);

  const scorePhoto = useCallback(
    async (url: string) => {
      const score = {
        url,
        quality: 70 + Math.floor(Math.random() * 30),
        lighting: 60 + Math.floor(Math.random() * 40),
        blur: 70 + Math.floor(Math.random() * 30),
        smile: 50 + Math.floor(Math.random() * 50),
        background: 60 + Math.floor(Math.random() * 40),
        appeal: 60 + Math.floor(Math.random() * 40),
        issues: [] as string[],
        suggestions: [] as string[],
      };
      store.addScore(score);
      return score;
    },
    [store],
  );

  return { scores: store.scores, topPhotos, averageAppeal, scorePhoto, enhancements: store.enhancements };
}

export function useAI() {
  const store = useAIStore();
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(
    async (type: string, input: unknown) => {
      if (!store.canUseFeature(type, 100)) throw new Error("Rate limit exceeded");
      setGenerating(true);
      try {
        const convo = {
          id: crypto.randomUUID(),
          userId: "current-user",
          type,
          input,
          output: { result: `Generated ${type}` },
          model: "heuristic",
          tokensUsed: 100,
          latencyMs: 200,
          createdAt: new Date().toISOString(),
        };
        store.addConversation(convo as never);
        return convo;
      } finally {
        setGenerating(false);
      }
    },
    [store],
  );

  return { ...store, generating, generate };
}

export function useChatEnhancements(conversationId: string) {
  const store = useChatEnhStore();
  const pinned = useMemo(() => store.getPinned(conversationId), [store, conversationId]);
  const ephemeral = useMemo(() => store.ephemeral[conversationId] ?? null, [store.ephemeral, conversationId]);

  const pin = useCallback(
    async (messageId: string) => {
      const pinnedMsg = {
        id: crypto.randomUUID(),
        conversationId,
        messageId,
        pinnedBy: "current-user",
        pinnedAt: new Date().toISOString(),
      };
      store.pinMessage(pinnedMsg as never);
      return pinnedMsg;
    },
    [store, conversationId],
  );

  return { pinned, ephemeral, pin, unpin: store.unpinMessage, setEphemeral: store.setEphemeral, logScreenshot: store.logScreenshot };
}

export function useSpeedDating() {
  const store = useSpeedDatingStore();
  const [joining, setJoining] = useState(false);

  const join = useCallback(
    async (eventId: string) => {
      setJoining(true);
      try {
        store.joinEvent(eventId, "current-user");
      } finally {
        setJoining(false);
      }
    },
    [store],
  );

  return { ...store, joining, join, leave: store.leaveEvent };
}

export function useCalendar() {
  const store = useCalendarStore();
  const upcoming = useMemo(() => store.getUpcoming(), [store]);
  const freeSlots = useMemo(() => store.getFreeSlots(), [store]);

  const addEvent = useCallback(
    async (event: Record<string, unknown>) => {
      const newEvent = { id: crypto.randomUUID(), ...event, createdAt: new Date().toISOString() } as never;
      store.addEvent(newEvent as never);
      return newEvent;
    },
    [store],
  );

  return { ...store, upcoming, freeSlots, addEvent };
}

export function useStats() {
  const store = useStatsStore();
  const replyRate = useMemo(() => store.getReplyRate(), [store]);
  const bestPhoto = useMemo(() => store.getBestPhoto(), [store]);
  return { ...store, replyRate, bestPhoto };
}

export function useConsumables() {
  const store = useConsumablesStore();
  const [purchasing, setPurchasing] = useState(false);

  const purchase = useCallback(
    async (sku: string, quantity = 1) => {
      setPurchasing(true);
      try {
        store.purchase(sku, quantity);
        return true;
      } finally {
        setPurchasing(false);
      }
    },
    [store],
  );

  return { ...store, purchasing, purchase, consume: store.consume };
}

export function useGridPresets() {
  const store = useGridPresetsStore();
  const quickPresets = useMemo(() => store.getQuickPresets(), [store]);
  const savedPresets = useMemo(() => store.getSavedPresets(), [store]);
  return { ...store, quickPresets, savedPresets };
}

export function useCompatibility(userA?: string, userB?: string) {
  const store = useCompatStore();
  const score = useMemo(() => {
    if (!userA || !userB) return null;
    return store.getScore(userA, userB);
  }, [store, userA, userB]);

  const calculate = useCallback(
    async (a: string, b: string) => {
      const newScore = {
        id: crypto.randomUUID(),
        userA: a,
        userB: b,
        score: 50 + Math.floor(Math.random() * 50),
        dimensions: { vibe: 0.7, intimacy: 0.6, logistics: 0.8, lifestyle: 0.7 },
        calculatedAt: new Date().toISOString(),
      };
      store.setScore(newScore as never);
      return newScore;
    },
    [store],
  );

  return { ...store, score, calculate };
}

export function useSafety() {
  const store = useSafetyStore();
  const [sharing, setSharing] = useState(false);

  const shareEmergency = useCallback(
    async (data: Record<string, unknown>) => {
      setSharing(true);
      try {
        const share = {
          id: crypto.randomUUID(),
          ...data,
          sharedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        store.shareEmergency(share as never);
        return share;
      } finally {
        setSharing(false);
      }
    },
    [store],
  );

  return { ...store, sharing, shareEmergency };
}

export function useOfflineQueue() {
  const store = useOfflineQueueStore();
  const pending = useMemo(() => store.getPending(), [store]);
  const [flushing, setFlushing] = useState(false);

  const flush = useCallback(async () => {
    setFlushing(true);
    try {
      await store.flush();
    } finally {
      setFlushing(false);
    }
  }, [store]);

  return { ...store, pending, flushing, flush };
}

export function useAppReady() {
  const appConfig = useAppConfig();
  const offline = useOfflineQueue();

  const isReady = useMemo(() => {
    return !appConfig.isLocked && !offline.pending.length;
  }, [appConfig.isLocked, offline.pending]);

  return {
    appConfig,
    offline,
    isReady,
  };
}
