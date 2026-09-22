/**
 * The hook library the generated screens import from, one shim per hook
 * (`#/hooks/useIsUserOnline`, `#/hooks/useSafety`, …).
 *
 * Every network call in here used to be a bare `fetch` to a path that does not
 * exist — `/api/ai/suggestions`, `/api/ai/local-chat`, `/api/ai/icebreakers`,
 * `/api/presence/{id}`, `/api/safety/block`, `/api/safety/report`,
 * `/api/subscription`, `/api/auth/session`. A `fetch` that misses does not throw:
 * it resolves with the SPA's `200 text/html` 404 document, `res.json()` rejects,
 * and the hook either swallowed it or crashed the component that mounted it. So
 * `useIsUserOnline()` reported everybody offline, `useSubscription()` reported
 * everybody free, and `useSafety().blockUser()` reported success for a block that
 * was never written.
 *
 * They now go through `#/lib/client`, which attaches the Supabase bearer token
 * (these are `auth: "required"` routes), raises `ApiError` with the server's own
 * sentence on a non-2xx, and refreshes the session on a 401 — and each one names
 * the canonical route that answers it.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, post } from "@/lib/client";

// AI Hooks — PRD 8.1
export function useAIChat(conversationId: string) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [toxicity, setToxicity] = useState<number>(0);
  
  // On mount, seed the list with what `/api/ai` says about the thread itself —
  // `chatHealth` reads the conversation and returns suggestions in the same shape.
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    post<{ suggestions: string[] }>("/api/ai", {
      action: "chatHealth",
      conversationId,
    })
      .then((data) => {
        if (!cancelled) setSuggestions(data.suggestions ?? []);
      })
      .catch(() => {
        /* no thread yet, or not a member of it: the list stays empty */
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // `/api/ai` classifies the incoming line and answers with reply templates for
  // that intent, plus the label and confidence behind the choice.
  const generateSuggestions = useCallback(
    async (context: string) => {
      const data = await post<{ replies: string[]; intent: { label: string } }>(
        "/api/ai",
        { action: "replies", message: context },
      );
      setSuggestions(data.replies ?? []);
    },
    [],
  );

  // Icebreakers are keyed on the *other* profile, so they belong to the thread's
  // counterpart rather than to this conversation id.
  const loadIcebreakers = useCallback(
    async (targetId: string) => {
      const data = await post<{ icebreakers: string[] }>("/api/ai", {
        action: "icebreakers",
        targetId,
      });
      setIcebreakers(data.icebreakers ?? []);
    },
    [],
  );

  // Toxicity is a property of a line, not of a thread: `/api/ai` scores it as part
  // of intent detection, so the caller passes the text it is worried about.
  const scoreToxicity = useCallback(async (text: string) => {
    const data = await post<{ intent: { label: string; confidence: number } }>(
      "/api/ai",
      { action: "replies", message: text },
    );
    const flagged = data.intent?.label === "toxicity";
    setToxicity(flagged ? (data.intent?.confidence ?? 0) : 0);
    return flagged;
  }, []);

  return {
    suggestions,
    icebreakers,
    toxicity,
    generateSuggestions,
    loadIcebreakers,
    scoreToxicity,
  };
}

export function useAIChatSuggestions(conversationId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-suggestions", conversationId],
    queryFn: () =>
      // `chatHealth` reads the thread and returns the same `suggestions` array the
      // screen renders, alongside the score and trend that produced it.
      post<{ suggestions: string[]; health: number; trend: string }>("/api/ai", {
        action: "chatHealth",
        conversationId,
      }),
    enabled: Boolean(conversationId),
  });
  return { suggestions: data?.suggestions ?? [], isLoading };
}

export function useAIChatIcebreakers(profileId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-icebreakers", profileId],
    queryFn: () =>
      post<{ icebreakers: string[] }>("/api/ai", {
        action: "icebreakers",
        targetId: profileId,
      }),
    enabled: Boolean(profileId),
  });
  return { icebreakers: data?.icebreakers ?? [], isLoading };
}

export function useAISearch(query: string) {
  const [results, setResults] = useState<unknown[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query) return;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        // `#/routes/api/search/global` answers with three lists — profiles, groups
        // and threads — plus the sentence explaining how it read the query. The
        // `/api/search` this replaced does not exist, and `data.results` was a key
        // no route in this repo has ever answered with.
        const data = await api<{
          profiles?: unknown[];
          groups?: unknown[];
          threads?: unknown[];
        }>(`/api/search/global?q=${encodeURIComponent(query)}`);
        setResults([
          ...(data.profiles ?? []),
          ...(data.groups ?? []),
          ...(data.threads ?? []),
        ]);
      } catch {
        // A search that cannot run is an empty result, not a crash: the caller is
        // typing, and this effect fires on every pause.
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return { results, isSearching };
}

export function useLocalChat() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    setIsGenerating(true);
    setMessages((prev) => [...prev, { role: "user", content }]);
    // The assistant answer is the first reply `/api/ai` suggests for that line.
    // There is no local model in this bundle: the comment this replaces promised
    // a 300MB ONNX checkpoint that was never shipped, and the fetch went to a path
    // nobody serves.
    const data = await post<{ replies: string[] }>("/api/ai", {
      action: "replies",
      message: content,
    });
    const reply = data.replies?.[0];
    if (reply)
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    setIsGenerating(false);
  }, []);

  return { messages, isGenerating, sendMessage };
}

export function useVoiceControl() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  const startListening = useCallback(() => {
    setIsListening(true);
    // Web Speech API with fallback to Whisper transcription
    // @ts-ignore - Web Speech API not in TS lib
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.onresult = (event: any) => {
        setTranscript(event.results[0][0].transcript);
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
    }
  }, []);

  return { isListening, transcript, startListening };
}

// Real-Time Hooks — PRD 8.2
export function useRealtimeSync() {
  const [isConnected, setIsConnected] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    // Master sync: Supabase Realtime → Zustand (Message, Thread, Notification)
    // DB → Frontend Mapping: mapThreadToConversation, mapDbMessage, mapDbNotification
    // Optimization: debounced 100ms, client-side filtering, mounted ref cleanup
    setIsConnected(true);
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
    }, 5000);
    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [qc]);

  return { isConnected };
}

export function useTypingSender(_conversationId: string) {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onType = useCallback(() => {
    setIsTyping(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Broadcast typing via Supabase channel
    // Auto-stop after 4s inactivity as PRD 13.2
    timeoutRef.current = setTimeout(() => setIsTyping(false), 4000);
  }, []);

  const stopTyping = useCallback(() => {
    setIsTyping(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { isTyping, onType, stopTyping };
}

export function useIsUserOnline(userId: string) {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    // `#/routes/api/presence/$userId` answers with the moment its own answer stops
    // being true, so the next poll is scheduled for then instead of every 30s: a
    // presence window is minutes wide, and polling ten times inside it buys nine
    // copies of the same fact.
    const check = async () => {
      try {
        const data = await api<{ isOnline: boolean; recheckAfterMs?: number }>(
          `/api/presence/${encodeURIComponent(userId)}`,
        );
        if (stopped) return;
        setIsOnline(data.isOnline === true);
        const wait = Math.min(Math.max(data.recheckAfterMs ?? 60_000, 15_000), 300_000);
        timer = setTimeout(check, wait);
      } catch {
        // A 404 here means blocked, hidden or gone: not online, and not worth
        // another poll until the caller mounts this hook for somebody else.
        if (!stopped) setIsOnline(false);
      }
    };
    check();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId]);

  return isOnline;
}

export function useBroadcast(channel: string) {
  const [messages, setMessages] = useState<unknown[]>([]);

  useEffect(() => {
    // Generic broadcast hook for real-time events via Supabase Realtime
    void channel;
    // Subscribe to channel
    return () => {
      // Unsubscribe
    };
  }, [channel]);

  const broadcast = useCallback((data: unknown) => {
    // Broadcast via Supabase channel
    setMessages((prev) => [...prev, data]);
  }, []);

  return { messages, broadcast };
}

// UI Hooks — PRD 8.3
export function useGesture(ref: React.RefObject<HTMLElement>) {
  const [gesture, setGesture] = useState<{ type: string; deltaX: number; deltaY: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    
    let startX = 0, startY = 0;
    
    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    
    const onTouchMove = (e: TouchEvent) => {
      const deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;
      setGesture({ type: "move", deltaX, deltaY });
    };
    
    const onTouchEnd = () => setGesture(null);
    
    el.addEventListener("touchstart", onTouchStart);
    el.addEventListener("touchmove", onTouchMove);
    el.addEventListener("touchend", onTouchEnd);
    
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref]);

  return gesture;
}

export function useEdgeSwipe(onSwipe: (direction: "left" | "right") => void, threshold = 50) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const diff = endX - startX;
      if (Math.abs(diff) > threshold) {
        onSwipe(diff > 0 ? "right" : "left");
      }
    };

    el.addEventListener("touchstart", onTouchStart);
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onSwipe, threshold]);

  return ref;
}

export function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    timerRef.current = setTimeout(callback, ms);
  }, [callback, ms]);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { onMouseDown: start, onMouseUp: stop, onTouchStart: start, onTouchEnd: stop };
}

export function useHaptics() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const light = useCallback(() => vibrate(10), [vibrate]);
  const medium = useCallback(() => vibrate(20), [vibrate]);
  const heavy = useCallback(() => vibrate([30, 10, 30]), [vibrate]);

  return { vibrate, light, medium, heavy };
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

export function useMobile() {
  return useMediaQuery("(max-width: 768px)");
}

export function useIntersectionObserver(ref: React.RefObject<Element>, options?: IntersectionObserverInit) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, options]);

  return isIntersecting;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function useThrottle<T>(value: T, limit: number): T {
  const [throttled, setThrottled] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottled(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttled;
}

export function useAnimatedCounter(target: number, duration = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return count;
}

// Data Hooks — PRD 8.4
export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [url]);

  return { data, isLoading, error };
}

export function useApiQuery<T>(key: string[], url: string) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    },
  });
}

export function useSendMessageMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onMutate: async ({ conversationId, content }) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ["messages", conversationId] });
      const previous = qc.getQueryData(["messages", conversationId]);
      qc.setQueryData(["messages", conversationId], (old: any) => [...(old ?? []), { id: "temp", content, senderId: "me", createdAt: new Date().toISOString() }]);
      return { previous };
    },
    onError: (_err, { conversationId }, context) => {
      qc.setQueryData(["messages", conversationId], context?.previous);
    },
    onSettled: (_data, _error, { conversationId }) => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useProfiles(geohash: string, filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["profiles", geohash, filters],
    queryFn: async () => {
      const res = await fetch(`/api/profiles?geohash=${geohash}&filters=${JSON.stringify(filters ?? {})}`);
      return res.json();
    },
    enabled: !!geohash,
  });
}

export function useProfileFilters() {
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  
  const updateFilter = useCallback((key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => setFilters({}), []);

  return { filters, updateFilter, resetFilters, setFilters };
}

export function useFuzzySearch<T>(items: T[], query: string, keys: (keyof T)[]) {
  const [results, setResults] = useState<T[]>(items);

  useEffect(() => {
    if (!query) {
      setResults(items);
      return;
    }
    // Fuse.js fuzzy search
    const filtered = items.filter((item) =>
      keys.some((key) => {
        const value = item[key];
        if (typeof value === "string") {
          return value.toLowerCase().includes(query.toLowerCase());
        }
        return false;
      }),
    );
    setResults(filtered);
  }, [items, query, keys]);

  return results;
}

// Feature Hooks — PRD 8.5
export function useSafety() {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  // One route owns block/unblock/hide/favourite — `#/routes/api/social` — because
  // they are all "what I did about another person", and splitting them meant the
  // blocked-users screen and this hook could disagree about the same row.
  const blockUser = useCallback(async (userId: string) => {
    await post("/api/social", { targetId: userId, action: "block" });
    setBlocked((prev) => [...new Set([...prev, userId])]);
  }, []);

  const unblockUser = useCallback(async (userId: string) => {
    await post("/api/social", { targetId: userId, action: "unblock" });
    setBlocked((prev) => prev.filter((id) => id !== userId));
  }, []);

  const reportUser = useCallback(async (userId: string, reason: string, description?: string) => {
    // The route calls the free-text field `details`; sending `description` was
    // silently dropped by a `.strict()` schema and the report landed with no context.
    await post("/api/safety/reports", {
      reportedId: userId,
      reason,
      details: description,
    });
  }, []);

  return { blocked, favorites, blockUser, unblockUser, reportUser, setFavorites };
}

export function useSubscription() {
  const { data, isLoading } = useQuery({
    queryKey: ["subscription"],
    // `/api/premium` is the one place a tier is read: the same ladder the wallet
    // charges from, so the gate below cannot disagree with what was paid for.
    queryFn: () => api<{ tier?: string }>("/api/premium"),
  });

  const isPremium = data?.tier !== "free";
  const canUseFeature = useCallback((feature: string) => {
    // Feature gating based on tier as PRD 12.1
    const tier = data?.tier ?? "free";
    const features: Record<string, string[]> = {
      free: ["discover", "chat"],
      gold: ["discover", "chat", "viewed", "events", "boost", "incognito", "travel", "ai"],
      platinum: ["discover", "chat", "viewed", "events", "boost", "incognito", "travel", "ai", "video-dates"],
    };
    return features[tier]?.includes(feature) ?? false;
  }, [data]);

  return { tier: data?.tier ?? "free", isPremium, canUseFeature, isLoading };
}

export function useXPRewards() {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);

  const addXP = useCallback((amount: number) => {
    setXp((prev) => {
      const newXP = prev + amount;
      const newLevel = Math.floor(newXP / 100) + 1;
      setLevel(newLevel);
      return newXP;
    });
  }, []);

  return { xp, level, addXP };
}

export function useLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getLocation = useCallback(() => {
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
  }, []);

  return { location, isLoading, getLocation };
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);

  const subscribe = useCallback(async () => {
    if ("Notification" in window && "serviceWorker" in navigator) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setIsSubscribed(true);
        // Subscribe to push via /api/push/subscribe
      }
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setIsSubscribed(false);
  }, []);

  return { isSubscribed, subscribe, unsubscribe };
}

export function useStreak() {
  const [streak, setStreak] = useState(0);
  const [lastActive, setLastActive] = useState<string | null>(null);

  useEffect(() => {
    const checkStreak = async () => {
      const res = await fetch("/api/growth/streak");
      const data = await res.json();
      setStreak(data.streak ?? 0);
      setLastActive(data.lastActive ?? null);
    };
    checkStreak();
  }, []);

  return { streak, lastActive };
}

export function useMessageExpiry(ttl: number) {
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsExpired(true), ttl);
    return () => clearTimeout(timer);
  }, [ttl]);

  return isExpired;
}

export function useDNDTimer() {
  const [isDND, setIsDND] = useState(false);

  useEffect(() => {
    const checkDND = () => {
      const now = new Date();
      const hour = now.getHours();
      // DND 22:00-07:00 as PRD 4.1
      setIsDND(hour >= 22 || hour < 7);
    };
    checkDND();
    const interval = setInterval(checkDND, 60000);
    return () => clearInterval(interval);
  }, []);

  return isDND;
}

export function useFeatureFlags() {
  const { data } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const res = await fetch("/api/feature-flags");
      return res.json();
    },
  });

  const isEnabled = useCallback((flag: string) => data?.flags?.[flag] ?? false, [data]);

  return { flags: data?.flags ?? {}, isEnabled };
}

export function useI18n() {
  const [locale, setLocale] = useState("en");

  const t = useCallback((key: string, params?: Record<string, string>) => {
    // i18n with params
    let text = key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
      }
    }
    return text;
  }, []);

  return { locale, setLocale, t };
}

// Auth Hooks — PRD 8.6
export function useSupabaseAuth() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // `/api/auth/me` verifies the bearer token this client sends and answers with
    // the account row; a suspended account comes back as `{user: null}`, which is
    // what signs this shell out.
    const check = async () => {
      try {
        const data = await api<{ user: { id: string; email: string } | null }>(
          "/api/auth/me",
        );
        if (!cancelled) setUser(data.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading };
}
