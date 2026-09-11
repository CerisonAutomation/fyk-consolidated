import { create } from "zustand";

export type ViewId = "discover" | "messages" | "taps" | "favorites" | "events" | "groups" | "shouts" | "tribes" | "meetnow" | "fansites" | "king-pet" | "premium" | "gamechangers" | "notifications" | "safety" | "settings" | "profile" | "board" | "guide" | "platform" | "nearby" | "explore" | "chats" | "likes" | "admin" | "benchmark";

type ToastItem = { id: string; message: string; type?: string };

type MediaItem = { url: string; type?: string; photo?: string; poster?: string; ownerName?: string; kind?: string; caption?: string; id?: string };

type Thread = { id: string; [k: string]: any };

type CheckInState = {
  status: "ARMED" | "OVERDUE" | "SAFE";
  dueAt: number;
  personId: string;
  contact: string;
  place: string;
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
  toggleFilter: (filter: string) => void;
  clearFilters: () => void;
  setLayout: (layout: string) => void;
  query: string;
  setQuery: (q: string) => void;

  // Profile
  setOpenProfile: (profile: any | null) => void;
  setLocked: (locked: boolean) => void;
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
  call: any | null;
  startCall: (target: any) => void;
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
  footprints: any[];
  leaveFootprint: (data: any) => void;

  // Social
  likesReceived: number;
  boost: () => void;
  queued: boolean;

  // Misc
  online: boolean;
};

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
  toggleFilter: () => {},
  clearFilters: () => {},
  setLayout: () => {},
  query: "",
  setQuery: (q) => set({ query: q }),

  // Profile
  setOpenProfile: () => {},
  setLocked: () => {},
  pin: () => {},

  // Voice
  voiceOn: false,
  setVoiceOn: (on) => set({ voiceOn: on }),
  voiceTranscript: "",
  setVoiceTranscript: (t) => set({ voiceTranscript: t }),

  // AI
  warmUpAi: () => {},

  // Media
  media: [],
  mediaIndex: 0,
  setMediaIndex: (i) => set({ mediaIndex: i }),
  closeMedia: () => set({ mediaIndex: 0 }),

  // Calls
  call: null,
  startCall: () => {},
  endCall: () => set({ call: null }),

  // Threads / Chat
  threads: [],
  activeThread: null,
  sendMessage: () => {},

  // Draft
  draft: "",
  setDraft: (d) => set({ draft: d }),

  // Check-in / Footprints
  checkIn: null,
  setCheckIn: (data) => set({ checkIn: data }),
  resolveCheckIn: () => set({ checkIn: null }),
  footprints: [],
  leaveFootprint: () => {},

  // Social
  likesReceived: 0,
  boost: () => {},
  queued: false,

  // Misc
  online: false,
}));

// Re-export useAppStore as useStore for backward compatibility
export { useAppStore as useStore };
