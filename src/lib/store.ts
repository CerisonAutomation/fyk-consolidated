import { create } from "zustand";
import { api } from "@/lib/client";

export type ViewId = "discover" | "messages" | "taps" | "favorites" | "events" | "groups" | "shouts" | "tribes" | "meetnow" | "fansites" | "king-pet" | "premium" | "gamechangers" | "notifications" | "safety" | "settings" | "profile" | "board" | "guide" | "platform" | "nearby" | "explore" | "chats" | "likes" | "admin" | "benchmark";

type ToastItem = { id: string; message: string; type?: string };

type MediaItem = { url: string; type?: string; photo?: string; poster?: string; ownerName?: string; kind?: string; caption?: string; id?: string };

type Thread = { id: string; [k: string]: any };

type CheckInState = {
  status: "ARMED" | "OVERDUE" | "SAFE";
  dueAt: number;
  personId: string;
  contactId: string;
  contact: string;
  place: string;
  checkInId: string;
};

type FootprintMap = Record<string, string>;

export type CallState = {
  personId: string;
  mode: "audio" | "video";
  status: "ringing" | "connected" | "ended";
  conversationId: string;
  userId: string;
  startedAt: number;
};

type AppState = {
  // User
  user: any | null;
  setUser: (user: any | null) => void;

  // Toasts
  toasts: ToastItem[];
  addToast: (message: string, type?: string) => void;
  pushToast: (message: string, type?: string) => void;
  removeToast: (id: string) => void;
  dismissToast: (id: string) => void;
  toast: (message: string, type?: string) => void;

  // Navigation / View
  view: ViewId;
  go: (view: ViewId) => void;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  mapOpen: boolean;
  setMapOpen: (open: boolean) => void;
  qrOpen: boolean;
  setQrOpen: (open: boolean) => void;

  // Theme
  theme: string;
  toggleTheme: () => void;

  // Filters / Layout
  filters: Record<string, boolean>;
  toggleFilter: (filter: string) => void;
  clearFilters: () => void;
  layout: string;
  setLayout: (layout: string) => void;
  query: string;
  setQuery: (q: string) => void;

  // Profile
  openProfile: string | null;
  setOpenProfile: (profile: string | null) => void;
  locked: boolean;
  setLocked: (locked: boolean) => void;
  pinned: string[];
  pin: (id: string) => void;

  // Voice
  voiceOn: boolean;
  setVoiceOn: (on: boolean) => void;
  voiceTranscript: string;
  setVoiceTranscript: (t: string) => void;

  // AI
  warmUpAi: () => void;

  // Media
  media: MediaItem[];
  mediaIndex: number;
  setMediaIndex: (i: number) => void;
  closeMedia: () => void;

  // Calls
  call: CallState | null;
  startCall: (target: { personId?: string; target?: string; id?: string; type?: "audio" | "video"; conversationId?: string }) => void;
  endCall: () => void;

  // Threads / Chat
  threads: Thread[];
  activeThread: string | null;
  sendMessage: (msg: any) => void;

  // Draft
  draft: string;
  setDraft: (d: string) => void;

  // Check-in / Footprints
  checkIn: CheckInState | null;
  setCheckIn: (data: CheckInState | null) => void;
  resolveCheckIn: (safe: boolean) => void;
  footprints: FootprintMap;
  leaveFootprint: (data: any) => void;

  // Social
  likesReceived: number;
  boost: () => void;
  queued: boolean;

  // Misc
  online: boolean;
};

/** Deterministic conversation ID from two user IDs — sorted so both sides derive the same key. */
function deriveConversationId(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export const useAppStore = create<AppState>((set, _get) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),

  // Toasts
  toasts: [],
  addToast: (message, type = "info") =>
    set((s) => ({ toasts: [...s.toasts, { id: crypto.randomUUID(), message, type }] })),
  pushToast: (message, type = "info") =>
    set((s) => ({ toasts: [...s.toasts, { id: crypto.randomUUID(), message, type }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  toast: (message, type = "info") =>
    set((s) => ({ toasts: [...s.toasts, { id: crypto.randomUUID(), message, type }] })),

  // Navigation / View
  view: "discover" as ViewId,
  go: (view) => set({ view }),
  navOpen: false,
  setNavOpen: (open) => set({ navOpen: open }),
  paletteOpen: false,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  mapOpen: false,
  setMapOpen: (open) => set({ mapOpen: open }),
  qrOpen: false,
  setQrOpen: (open) => set({ qrOpen: open }),

  // Theme
  theme: "light",
  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),

  // Filters / Layout
  filters: {},
  toggleFilter: (filter) =>
    set((s) => ({
      filters: { ...s.filters, [filter]: !s.filters[filter] },
    })),
  clearFilters: () => set({ filters: {} }),
  layout: "grid",
  setLayout: (layout) => set({ layout }),
  query: "",
  setQuery: (q) => set({ query: q }),

  // Profile
  openProfile: null,
  setOpenProfile: (profile) => set({ openProfile: profile }),
  locked: false,
  setLocked: (locked) => set({ locked }),
  pinned: [],
  pin: (id) =>
    set((s) => ({
      pinned: s.pinned.includes(id)
        ? s.pinned.filter((p) => p !== id)
        : [...s.pinned, id],
    })),

  // Voice
  voiceOn: false,
  setVoiceOn: (on) => set({ voiceOn: on }),
  voiceTranscript: "",
  setVoiceTranscript: (t) => set({ voiceTranscript: t }),

  // AI
  warmUpAi: () => {
    api("/api/ai/warmup").catch(() => {});
  },

  // Media
  media: [],
  mediaIndex: 0,
  setMediaIndex: (i) => set({ mediaIndex: i }),
  closeMedia: () => set({ mediaIndex: 0 }),

  // Calls
  call: null,
  startCall: (target) => {
    const personId = target.target ?? target.personId ?? target.id ?? "";
    const userId = _get().user?.id ?? "local";
    const conversationId = target.conversationId ?? deriveConversationId(userId, personId);
    set({
      call: {
        personId,
        mode: target.type ?? "audio",
        status: "ringing",
        conversationId,
        userId,
        startedAt: Date.now(),
      },
    });
  },
  endCall: () => set({ call: null }),

  // Threads / Chat
  threads: [],
  activeThread: null,
  sendMessage: (msg) =>
    set((s) => {
      const threadId = msg.threadId ?? msg.id ?? s.activeThread;
      const body = msg.body ?? msg.text ?? "";
      if (!threadId || !body) return s;

      const thread: Thread = {
        id: threadId,
        messages: [
          ...((s.threads.find((t) => t.id === threadId)?.messages as any[]) ?? []),
          {
            id: crypto.randomUUID(),
            body,
            senderId: s.user?.id ?? "me",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const exists = s.threads.findIndex((t) => t.id === threadId);
      const threads =
        exists >= 0
          ? s.threads.map((t) => (t.id === threadId ? thread : t))
          : [...s.threads, thread];

      return { threads, draft: "" };
    }),

  // Draft
  draft: "",
  setDraft: (d) => set({ draft: d }),

  // Check-in / Footprints
  checkIn: null,
  setCheckIn: (data) => set({ checkIn: data }),
  resolveCheckIn: (safe: boolean) => { const ci = _get().checkIn; if (ci) { api("/api/safety/check-in/resolve", { method: "POST", body: { checkInId: ci.checkInId, contactId: ci.contactId, safe } }).catch(() => {}); } set({ checkIn: null }); },
  footprints: {},
  leaveFootprint: (data) => {
    set((s) => ({
      footprints: { ...s.footprints, [data.personId]: data.footprintId ?? data.id },
    }));
    api("/api/social", {
      method: "POST",
      body: { action: "footprint", targetId: data.personId, footprintId: data.footprintId },
    }).catch(() => {});
  },

  // Social
  likesReceived: 0,
  boost: () => {
    api("/api/boost", { method: "POST" }).catch(() => {});
  },
  queued: false,

  // Misc
  online: false,
}));

// Re-export useAppStore as useStore for backward compatibility
export { useAppStore as useStore };
