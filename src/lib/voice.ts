/**
 * Voice navigation, dictation and read-back.
 * Uses the browser's built-in Web Speech API — no keys, no cloud service of ours.
 * Chrome/Edge/Safari route recognition through the platform's own speech service; we say so
 * plainly in the UI rather than pretending it is fully on-device.
 */

export type VoiceCommand = {
  id: string;
  phrases: string[];
  description: string;
  group: "Navigate" | "Discover" | "Chat" | "System";
};

export const COMMANDS: VoiceCommand[] = [
  { id: "go:nearby", phrases: ["nearby", "go to nearby", "show nearby", "who's around"], description: "Open Nearby", group: "Navigate" },
  { id: "go:explore", phrases: ["explore", "go to explore", "show cities"], description: "Open Explore", group: "Navigate" },
  { id: "go:chats", phrases: ["chats", "messages", "open chats", "go to chats"], description: "Open Chats", group: "Navigate" },
  { id: "go:events", phrases: ["events", "open events", "what's on"], description: "Open Events", group: "Navigate" },
  { id: "go:likes", phrases: ["likes", "who liked me", "open likes"], description: "Open Likes & visitors", group: "Navigate" },
  { id: "go:profile", phrases: ["profile", "my profile", "open profile"], description: "Open your profile", group: "Navigate" },
  { id: "go:board", phrases: ["board", "the board", "what's on", "who's free", "available now"], description: "Open the Board", group: "Navigate" },
  { id: "go:guide", phrases: ["guide", "venues", "bars", "clubs", "open guide"], description: "Open the Guide", group: "Navigate" },
  { id: "go:settings", phrases: ["settings", "open settings", "preferences"], description: "Open Settings", group: "Navigate" },
  { id: "go:safety", phrases: ["safety", "safety centre", "safety center"], description: "Open the Safety centre", group: "Navigate" },
  { id: "filter:online", phrases: ["online only", "show online", "filter online"], description: "Toggle the Online-now filter", group: "Discover" },
  { id: "filter:clear", phrases: ["clear filters", "reset filters", "show everyone"], description: "Clear every filter", group: "Discover" },
  { id: "layout:compact", phrases: ["compact grid", "small cards"], description: "Switch to the compact grid", group: "Discover" },
  { id: "layout:cascade", phrases: ["big cards", "cascade", "large cards"], description: "Switch to cascade cards", group: "Discover" },
  { id: "map:toggle", phrases: ["show map", "map view", "hide map"], description: "Toggle the map", group: "Discover" },
  { id: "chat:send", phrases: ["send message", "send it", "send that"], description: "Send the drafted message", group: "Chat" },
  { id: "chat:reply", phrases: ["smart reply", "suggest a reply", "help me reply"], description: "Generate smart replies", group: "Chat" },
  { id: "chat:read", phrases: ["read messages", "read it out", "read the chat"], description: "Read the last messages aloud", group: "Chat" },
  { id: "chat:call", phrases: ["call them", "start a call", "voice call"], description: "Start a voice call", group: "Chat" },
  { id: "boost", phrases: ["boost me", "boost my profile"], description: "Boost your profile for 30 minutes", group: "System" },
  { id: "party", phrases: ["party mode", "show my code", "show qr"], description: "Open the party-mode QR", group: "System" },
  { id: "theme:toggle", phrases: ["dark mode", "light mode", "switch theme"], description: "Switch theme", group: "System" },
  { id: "palette:open", phrases: ["command palette", "open commands", "search commands"], description: "Open the command palette", group: "System" },
  { id: "voice:stop", phrases: ["stop listening", "voice off", "stop voice"], description: "Stop voice control", group: "System" },
];

type Handler = (commandId: string, transcript: string) => void;

function normalise(s: string) {
  return s.toLowerCase().replace(/[^\w\s']/g, " ").replace(/\s+/g, " ").trim();
}

/** Levenshtein-lite similarity so "go to nearbee" still resolves. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const al = a.length;
  const bl = b.length;
  if (!al || !bl) return 0;
  const prev = new Array(bl + 1).fill(0).map((_, i) => i);
  const cur = new Array(bl + 1).fill(0);
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= bl; j++) prev[j] = cur[j];
  }
  return 1 - prev[bl] / Math.max(al, bl);
}

export function matchCommand(transcript: string): { id: string; score: number } | null {
  const t = normalise(transcript);
  if (!t) return null;
  let best: { id: string; score: number } | null = null;
  for (const cmd of COMMANDS) {
    for (const phrase of cmd.phrases) {
      const score = similarity(t, normalise(phrase));
      if (!best || score > best.score) best = { id: cmd.id, score };
    }
  }
  return best && best.score >= 0.62 ? best : null;
}

/** "message theo hey how are you" → { target: "theo", body: "hey how are you" } */
export function parseDictation(transcript: string): { target?: string; body: string } | null {
  const m = normalise(transcript).match(/^(?:message|text|tell|reply to)\s+(\w+)\s+(.+)$/);
  if (m) return { target: m[1], body: m[2]!.charAt(0).toUpperCase() + m[2]!.slice(1) };
  const s = normalise(transcript).match(/^(?:say|type|write)\s+(.+)$/);
  if (s) return { body: s[1]!.charAt(0).toUpperCase() + s[1]!.slice(1) };
  return null;
}

type SR = any;

export class VoiceController {
  supported: boolean;
  listening = false;
  lastTranscript = "";

  private rec: SR | null = null;
  private handler: Handler | null = null;
  private dictationHandler: ((text: string) => void) | null = null;
  private stateHandler: ((s: { listening: boolean; transcript: string; matched?: string }) => void) | null = null;
  private mode: "command" | "dictation" = "command";

  constructor() {
    const w = window as any;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    this.supported = !!Ctor;
    if (Ctor) {
      const rec: SR = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (event: any) => {
        let text = "";
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }
        this.lastTranscript = text.trim();
        this.stateHandler?.({ listening: true, transcript: this.lastTranscript });
        if (!isFinal) return;

        if (this.mode === "dictation") {
          this.dictationHandler?.(this.lastTranscript);
          return;
        }
        const dictated = parseDictation(this.lastTranscript);
        if (dictated) {
          this.dictationHandler?.(dictated.body);
          this.stateHandler?.({ listening: true, transcript: this.lastTranscript, matched: "dictation" });
          return;
        }
        const match = matchCommand(this.lastTranscript);
        if (match) {
          this.handler?.(match.id, this.lastTranscript);
          this.stateHandler?.({ listening: true, transcript: this.lastTranscript, matched: match.id });
        }
      };
      rec.onend = () => {
        if (this.listening) {
          try {
            rec.start();
          } catch {
            this.listening = false;
            this.stateHandler?.({ listening: false, transcript: "" });
          }
        } else {
          this.stateHandler?.({ listening: false, transcript: "" });
        }
      };
      rec.onerror = () => {
        this.listening = false;
        this.stateHandler?.({ listening: false, transcript: "" });
      };
      this.rec = rec;
    }
  }

  on(handler: Handler) {
    this.handler = handler;
  }
  onDictation(handler: (text: string) => void) {
    this.dictationHandler = handler;
  }
  onState(handler: (s: { listening: boolean; transcript: string; matched?: string }) => void) {
    this.stateHandler = handler;
  }

  start(mode: "command" | "dictation" = "command") {
    if (!this.rec || this.listening) return false;
    this.mode = mode;
    try {
      this.rec.start();
      this.listening = true;
      this.stateHandler?.({ listening: true, transcript: "" });
      return true;
    } catch {
      return false;
    }
  }

  stop() {
    if (!this.rec) return;
    this.listening = false;
    try {
      this.rec.stop();
    } catch {
      /* already stopped */
    }
    this.stateHandler?.({ listening: false, transcript: "" });
  }

  toggle(mode: "command" | "dictation" = "command") {
    return this.listening ? (this.stop(), false) : this.start(mode);
  }
}

/* --------------------------------- speech -------------------------------- */

export function speak(text: string, opts: { rate?: number; lang?: string } = {}) {
  if (typeof speechSynthesis === "undefined") return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 1.03;
  u.pitch = 1;
  u.lang = opts.lang ?? "en-US";
  speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
