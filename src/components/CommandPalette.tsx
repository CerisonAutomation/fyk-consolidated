import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Compass,
  Heart,
  Languages,
  LayoutGrid,
  Lock,
  MapPin,
  MessageCircle,
  Mic,
  MicOff,
  Moon,
  Search,
  Settings,
  Shield,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useStore, type ViewId } from "@/lib/store";
import { COMMANDS, VoiceController, speak } from "@/lib/voice";
import { richPeople } from "@/lib/profiles";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  group: string;
  run: () => void;
};

export function CommandPalette() {
  const store = useStore();
  const {
    paletteOpen,
    setPaletteOpen,
    go,
    toggleTheme,
    toggleFilter,
    clearFilters,
    setLayout,
    setMapOpen,
    mapOpen,
    setOpenProfile,
    warmUpAi,
    setLocked,
    /* pin (unused — store exposes a profile-pinning function, not a security PIN flag) */
    voiceOn,
    toast,
  } = store;
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = useMemo<Action[]>(() => {
    const nav: [ViewId, string, React.ElementType][] = [
      ["nearby", "Go to Nearby", MapPin],
      ["explore", "Go to Explore", Compass],
      ["chats", "Go to Chats", MessageCircle],
      ["events", "Go to Events", Calendar],
      ["likes", "Go to Likes & visitors", Heart],
      ["profile", "Go to Profile", User],
      ["board", "Go to Board — who\u2019s free right now", Sparkles],
      ["guide", "Go to Guide — venues & clubs", MapPin],
      ["safety", "Go to Safety centre", Shield],
      ["settings", "Go to Settings", Settings],
    ];
    const base: Action[] = nav.map(([id, label, icon]) => ({
      id: `nav-${id}`,
      label,
      icon,
      group: "Navigate",
      run: () => go(id),
    }));

    base.push(
      { id: "theme", label: "Toggle dark / light theme", icon: Moon, group: "System", run: toggleTheme },
      { id: "f-online", label: "Toggle Online-now filter", icon: Sparkles, group: "Discover", run: () => toggleFilter("online") },
      { id: "f-clear", label: "Clear all filters", icon: Search, group: "Discover", run: clearFilters },
      { id: "l-compact", label: "Compact grid", icon: LayoutGrid, group: "Discover", run: () => setLayout("compact") },
      { id: "l-cascade", label: "Cascade cards", icon: LayoutGrid, group: "Discover", run: () => setLayout("cascade") },
      { id: "map", label: mapOpen ? "Hide the map" : "Show the map", icon: MapPin, group: "Discover", run: () => setMapOpen(!mapOpen) },
      { id: "ai", label: "Load the on-device AI model", hint: "all-MiniLM-L6-v2 · int8", icon: Wand2, group: "AI", run: warmUpAi },
      {
        id: "lock",
        label: "Lock the app now",
        hint: "Set a PIN in Settings first",
        icon: Lock,
        group: "System",
        run: () => toast("Set an app-lock PIN first: Settings \u2039 Security.", "violet"),
      },
      {
        id: "speak",
        label: "Read this screen aloud",
        icon: Languages,
        group: "System",
        run: () => speak(`You are on the ${store.view} screen. ${richPeople.length} sample profiles are loaded.`),
      },
    );

    for (const p of richPeople.slice(0, 14)) {
      base.push({
        id: `p-${p.id}`,
        label: `${p.name}, ${p.age}`,
        hint: `${p.area} · ${p.headline}`,
        icon: User,
        group: "Preview profiles",
        run: () => setOpenProfile(p.id),
      });
    }
    return base;
  }, [go, toggleTheme, toggleFilter, clearFilters, setLayout, mapOpen, setMapOpen, warmUpAi, setLocked, toast, setOpenProfile, store.view]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions.slice(0, 12);
    return actions
      .filter((a) => `${a.label} ${a.hint ?? ""} ${a.group}`.toLowerCase().includes(needle))
      .slice(0, 14);
  }, [q, actions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
      if (e.key === "Escape" && paletteOpen) setPaletteOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setQ("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [paletteOpen]);

  if (!paletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-[12vh]">
      <div className="anim-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPaletteOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="anim-sheet relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                const item = results[cursor];
                if (item) {
                  item.run();
                  setPaletteOpen(false);
                }
              }
            }}
            placeholder="Search people, screens and commands…"
            aria-label="Search commands"
            className="h-[56px] w-full bg-transparent text-[15px] outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted sm:block">
            ESC
          </kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto scroll-thin p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-[13.5px] text-muted">No matches.</li>}
          {results.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => {
                  a.run();
                  setPaletteOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  i === cursor ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60",
                )}
              >
                <a.icon className="h-[17px] w-[17px] shrink-0 text-faint" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{a.label}</span>
                  {a.hint && <span className="block truncate text-[12px] text-muted">{a.hint}</span>}
                </span>
                <span className="shrink-0 rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {a.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-[11.5px] text-faint">
          <span>↑↓ navigate</span>
          <span>⏎ run</span>
          <span className="ml-auto flex items-center gap-1.5">
            {voiceOn ? <Mic className="h-3.5 w-3.5 text-gold" /> : <MicOff className="h-3.5 w-3.5" />}
            Voice {voiceOn ? "listening" : "off"}
          </span>
        </footer>
      </div>
    </div>
  );
}

/* ---------------------------- voice controller --------------------------- */

export function VoiceLayer() {
  const store = useStore();
  const {
    voiceOn,
    setVoiceOn,
    setVoiceTranscript,
    voiceTranscript,
    go,
    toggleTheme,
    toggleFilter,
    clearFilters,
    setLayout,
    setMapOpen,
    mapOpen,
    setPaletteOpen,
    setDraft,
    draft,
    sendMessage,
    activeThread,
    threads,
    startCall,
    toast,
  } = store;
  const ctl = useRef<VoiceController | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const c = new VoiceController();
    ctl.current = c;
    setSupported(c.supported);
    return () => c.stop();
  }, []);

  useEffect(() => {
    const c = ctl.current;
    if (!c) return;
    c.onState((s) => setVoiceTranscript(s.transcript));
    c.onDictation((text) => {
      setDraft(text);
      toast(`Dictated: "${text}" \u2014 say "send message" to send.`, "violet");
    });
    c.on((id) => {
      switch (id) {
        case "go:nearby": return go("nearby");
        case "go:explore": return go("explore");
        case "go:chats": return go("chats");
        case "go:events": return go("events");
        case "go:likes": return go("likes");
        case "go:profile": return go("profile");
        case "go:board": return go("board");
        case "go:guide": return go("guide");
        case "go:benchmark": return go("benchmark");
        case "go:platform": return go("platform");
        case "boost": return store.boost();
        case "party": return store.setQrOpen(true);
        case "go:settings": return go("settings");
        case "go:safety": return go("safety");
        case "go:admin": return go("admin");
        case "filter:online": return toggleFilter("online");
        case "filter:verified": return toggleFilter("verified");
        case "filter:clear": return clearFilters();
        case "layout:compact": return setLayout("compact");
        case "layout:cascade": return setLayout("cascade");
        case "map:toggle": return setMapOpen(!mapOpen);
        case "palette:open": return setPaletteOpen(true);
        case "theme:toggle": return toggleTheme();
        case "chat:send": {
          if (draft.trim()) {
            sendMessage({ threadId: activeThread, body: draft });
            setDraft("");
            speak("Sent.");
          }
          return;
        }
        case "chat:read": {
          const t = threads.find((x) => x.id === activeThread);
          const last = t?.messages.slice(-3).map((m: { from?: string; body?: string }) => `${m.from === "me" ? "You said" : "They said"} ${m.body ?? ""}`);
          speak(last?.join(". ") ?? "No messages yet.");
          return;
        }
        case "chat:call": {
          const t = threads.find((x) => x.id === activeThread);
          if (t) startCall({ target: t.personId, type: "audio" });
          return;
        }
        case "voice:stop": {
          c.stop();
          setVoiceOn(false);
          return;
        }
        default:
          return;
      }
    });
  }, [
    go, toggleTheme, toggleFilter, clearFilters, setLayout, setMapOpen, mapOpen, setPaletteOpen,
    setDraft, draft, sendMessage, activeThread, threads, startCall, setVoiceOn, setVoiceTranscript, toast,
  ]);

  useEffect(() => {
    const c = ctl.current;
    if (!c) return;
    if (voiceOn) {
      const ok = c.start("command");
      if (!ok && !c.supported) {
        setVoiceOn(false);
        toast("Voice control isn't supported here: Try Chrome, Edge or Safari.", "violet");
      }
    } else {
      c.stop();
    }
  }, [voiceOn, setVoiceOn, toast]);

  if (!voiceOn || !supported) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[86px] z-[100] flex justify-center px-4 lg:bottom-6">
      <div className="anim-sheet pointer-events-auto flex max-w-[min(94vw,32rem)] items-center gap-3 rounded-full border border-gold/40 bg-surface/95 py-2.5 pl-4 pr-2.5 shadow-[var(--shadow-pop)] backdrop-blur">
        <span className="relative grid h-8 w-8 shrink-0 place-items-center">
          <span className="anim-ping absolute h-3 w-3 rounded-full bg-gold" />
          <Mic className="relative h-[17px] w-[17px] text-gold" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink-2">
          {voiceTranscript || 'Listening — try "go to chats" or "message theo see you at eight".'}
        </p>
        <button
          type="button"
          onClick={() => setVoiceOn(false)}
          className="press shrink-0 rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:text-ink"
        >
          Stop
        </button>
      </div>
    </div>
  );
}

export { COMMANDS };
