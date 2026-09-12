/**
 * Competitive feature matrix — Grindr vs ROMEO vs MACHOBB vs FYK.
 *
 * Sources (checked 2026): Grindr product pages + press coverage of Right Now / Map View;
 * ROMEO (PlanetRomeo) support docs, datingscout & datereviewers feature breakdowns;
 * MACHOBB / OMOLINK product pages and the operator's own feature posts.
 *
 * Honesty rules for this table:
 *  • "yes" means shipped and usable. "premium" means gated behind a paid tier.
 *  • "partial" means it exists but is materially narrower than the best-in-class version.
 *  • FYK rows describe what this build actually does — nothing aspirational.
 */

export type Support = "yes" | "premium" | "partial" | "no";

export type Row = {
  feature: string;
  detail: string;
  grindr: Support;
  romeo: Support;
  machobb: Support;
  fyk: Support;
  fykNote: string;
  /** true when FYK does something none of the three ship at all. */
  lead?: boolean;
};

export type Category = { id: string; title: string; blurb: string; rows: Row[] };

export const MATRIX: Category[] = [
  {
    id: "discovery",
    title: "Discovery & search",
    blurb: "The grid is the product. Everyone does it; the differences are in filters, sorting and honesty about distance.",
    rows: [
      {
        feature: "Proximity cascade grid",
        detail: "Distance-sorted grid of nearby profiles — the format Grindr made standard.",
        grindr: "yes", romeo: "yes", machobb: "yes", fyk: "yes",
        fykNote: "Cascade and compact layouts, persisted per user.",
      },
      {
        feature: "Live map of nearby people",
        detail: "Sniffies-style map. Grindr added it to Right Now in select cities; MACHOBB promotes a 'connect now' map.",
        grindr: "partial", romeo: "no", machobb: "yes", fyk: "yes",
        fykNote: "Leaflet + OpenStreetMap, every pin deterministically fuzzed with an approximate-area halo.",
      },
      {
        feature: "Browse another city before you travel",
        detail: "Grindr calls it Explore/Roam, ROMEO calls it Travel.",
        grindr: "premium", romeo: "yes", machobb: "partial", fyk: "yes",
        fykNote: "Explore ships free with 7 bundled cities and an offline city set — no geocoder call.",
      },
      {
        feature: "Travel plans with arrival dates",
        detail: "Publish that you're arriving in a city on set dates. ROMEO's strongest discovery feature.",
        grindr: "no", romeo: "yes", machobb: "no", fyk: "yes",
        fykNote: "3-day visibility lead on Free, 14 on Plus, auto-expiring with a Travelling badge.",
      },
      {
        feature: "Advanced filters",
        detail: "Age, distance, tribe, body, position, looking-for, verified, album, hosting.",
        grindr: "premium", romeo: "premium", machobb: "premium", fyk: "partial",
        fykNote: "Age, distance, online, verified, photo-only free. Tribe/kink/hosting/album/travel on Plus.",
      },
      {
        feature: "Saved filter presets",
        detail: "Store a filter set and reapply it.",
        grindr: "premium", romeo: "premium", machobb: "premium", fyk: "yes",
        fykNote: "One preset free, unlimited on Plus, named and deletable.",
      },
      {
        feature: "Compatibility scoring",
        detail: "Rank by shared interests rather than raw distance.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Weighted tag overlap + looking-for reciprocity + deal-breaker pass, formula documented.",
      },
      {
        feature: "Semantic natural-language search",
        detail: "Search meaning, not substrings — 'guys into hiking and quiet nights'.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "MiniLM sentence embeddings ranked by cosine similarity, entirely on-device.",
      },
      {
        feature: "Time-boxed availability",
        detail: "Say what you're up for and for how long, then it clears itself.",
        grindr: "partial", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "44 activities from coffee to hookup, with a window, a place mode and spare-spot count.",
      },
      {
        feature: "Activity-based discovery",
        detail: "Filter the grid by what people want to do, not just what they look like.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Every card shows a live activity badge; the grid filters on it.",
      },
      {
        feature: "Community board / posts",
        detail: "Post an open invite, a spare ticket, a lift, a photo.",
        grindr: "no", romeo: "partial", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Five post types with joins, comments, spare spots and automatic expiry.",
      },
      {
        feature: "Right Now / tonight mode",
        detail: "A separate feed for people free immediately. Grindr's newest headline feature.",
        grindr: "yes", romeo: "no", machobb: "yes", fyk: "yes",
        fykNote: "Right Now filter with hosting status and an auto-expiring window.",
      },
    ],
  },
  {
    id: "profiles",
    title: "Profiles & identity",
    blurb: "ROMEO wins on depth, Grindr on speed. The gap is in honest verification and health language.",
    rows: [
      {
        feature: "Rich structured profile",
        detail: "Stats, tribes, languages, relationship status, interaction style.",
        grindr: "yes", romeo: "yes", machobb: "yes", fyk: "yes",
        fykNote: "18 structured fields plus response rate, tenure and languages.",
      },
      {
        feature: "Tribes / community tags",
        detail: "Bear, Otter, Daddy, Jock, Twink and so on.",
        grindr: "yes", romeo: "yes", machobb: "yes", fyk: "yes",
        fykNote: "18 tribes, self-described only, never algorithmically assigned.",
      },
      {
        feature: "Kink & fetish tags",
        detail: "Explicit interest tagging. MACHOBB's whole positioning is niche-first.",
        grindr: "partial", romeo: "yes", machobb: "yes", fyk: "yes",
        fykNote: "26 consent-forward kink tags, three-tier exposure gate, never filterable against you.",
      },
      {
        feature: "Private albums with grant/revoke",
        detail: "ROMEO's QuickShare; Grindr's Albums.",
        grindr: "yes", romeo: "yes", machobb: "yes", fyk: "yes",
        fykNote: "Full state machine: request → approve → revoke, from profile or chat. No daily request cap.",
      },
      {
        feature: "Photo verification",
        detail: "Pose selfie matched to profile photos.",
        grindr: "yes", romeo: "yes", machobb: "partial", fyk: "yes",
        fykNote: "Labelled 'Photo verified (manual review)'. We never call it identity verification.",
      },
      {
        feature: "Sexual health fields",
        detail: "Status, last tested, PrEP, vaccinations. Grindr surfaces these prominently.",
        grindr: "yes", romeo: "yes", machobb: "yes", fyk: "yes",
        fykNote: "Opt-in, stigma-free wording, never filterable by others, never in third-party exports.",
      },
      {
        feature: "Interaction style signal",
        detail: "ROMEO's 'Manner' — Flirty / Friendly / Direct — sets expectations up front.",
        grindr: "no", romeo: "yes", machobb: "no", fyk: "yes",
        fykNote: "Five manners plus an explicit boundaries card.",
      },
      {
        feature: "Consent & boundaries card",
        detail: "State what you're up for and what's off the table, before anyone asks.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Structured yes/ask-me/no lists shown on the profile and pinned in chat.",
      },
      {
        feature: "Profile completion coaching",
        detail: "Score plus next-best-action hints.",
        grindr: "partial", romeo: "no", machobb: "no", fyk: "yes",
        fykNote: "Weighted rubric with a live ring and specific suggestions.",
      },
      {
        feature: "AI bio assistant",
        detail: "Rewrite your bio in a chosen tone.",
        grindr: "partial", romeo: "no", machobb: "no", fyk: "yes",
        fykNote: "Four tones, runs offline, never invents facts about you.",
      },
    ],
  },
  {
    id: "chat",
    title: "Messaging & calling",
    blurb: "The biggest gap in the category: neither Grindr nor ROMEO ships a native video call.",
    rows: [
      {
        feature: "Text, photos, emoji",
        detail: "Table stakes.",
        grindr: "yes", romeo: "yes", machobb: "yes", fyk: "yes",
        fykNote: "Plus reply-quoting, edit, unsend and delete-for-me.",
      },
      {
        feature: "Voice messages",
        detail: "Record and send audio.",
        grindr: "yes", romeo: "yes", machobb: "partial", fyk: "yes",
        fykNote: "MediaRecorder capture with a live waveform and scrubbable playback.",
      },
      {
        feature: "Voice calls",
        detail: "In-app audio calling.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Real WebRTC peer connection with live mute and a running timer.",
      },
      {
        feature: "Video calls",
        detail: "In-app video. ROMEO's own docs state there is no audio or video call.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "getUserMedia capture, camera flip, screen share via replaceTrack.",
      },
      {
        feature: "Paid / locked media",
        detail: "Charge for a photo set. Only OnlyFans-style platforms usually do this.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Per-item pricing, credit wallet, revocable access, every view logged.",
      },
      {
        feature: "View-once video",
        detail: "Record a clip that burns after it's opened.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "MediaRecorder capture, 10-second burn timer, watermarked viewer.",
      },
      {
        feature: "Seen receipts on media",
        detail: "Know who actually opened your photo, not just the message.",
        grindr: "partial", romeo: "no", machobb: "no", fyk: "yes",
        fykNote: "Per-item view log shown on your own album tiles.",
      },
      {
        feature: "Full-screen media viewer",
        detail: "Proper immersive photo and video viewing with swipe navigation.",
        grindr: "yes", romeo: "partial", machobb: "yes", fyk: "yes",
        fykNote: "Keyboard, swipe, burn timers, paywall gate, tab-blur and name watermark.",
      },
      {
        feature: "Real device geolocation",
        detail: "Use an actual GPS fix rather than a city you typed in.",
        grindr: "yes", romeo: "partial", machobb: "yes", fyk: "yes",
        fykNote: "Snapped to a 250 m grid the instant it arrives; the precise fix is never stored.",
      },
      {
        feature: "Disappearing photos",
        detail: "Expiring media in chat.",
        grindr: "yes", romeo: "no", machobb: "partial", fyk: "yes",
        fykNote: "10s / 1h / 24h. Plus sets the timer; Free can always view.",
      },
      {
        feature: "Read receipts & typing",
        detail: "Delivery and typing state.",
        grindr: "premium", romeo: "partial", machobb: "premium", fyk: "yes",
        fykNote: "Typing free for everyone; receipt display is a Plus control, honestly labelled.",
      },
      {
        feature: "Saved phrases",
        detail: "Reusable canned openers. A named ROMEO and Grindr feature.",
        grindr: "yes", romeo: "yes", machobb: "no", fyk: "yes",
        fykNote: "Editable phrase bank, insert with one tap.",
      },
      {
        feature: "Message translation",
        detail: "Translate an incoming message inline.",
        grindr: "premium", romeo: "no", machobb: "no", fyk: "yes",
        fykNote: "opus-mt pairs downloaded on demand, cached offline, with a phrasebook fallback.",
      },
      {
        feature: "Smart reply suggestions",
        detail: "Context-aware suggested replies.",
        grindr: "partial", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Candidate replies ranked against the last six messages by on-device embeddings.",
      },
      {
        feature: "Intent detection",
        detail: "Label what a message is actually asking for.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Seven intents — including safety_risk — shown as a chip under the bubble.",
      },
      {
        feature: "Auto plan detection",
        detail: "Turn 'drinks Saturday at 9 at Sky Lounge' into a confirmable plan.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Local date parser extracts time, place and intention; both sides Agree; .ics downloads.",
      },
      {
        feature: "Live location sharing",
        detail: "Share where you are for a fixed window.",
        grindr: "yes", romeo: "no", machobb: "partial", fyk: "yes",
        fykNote: "15/60 minute windows, auto-expiring, with a one-time safety interstitial.",
      },
      {
        feature: "Group chats",
        detail: "More than two people in a thread.",
        grindr: "partial", romeo: "yes", machobb: "no", fyk: "yes",
        fykNote: "Group threads with a member roster.",
      },
    ],
  },
  {
    id: "community",
    title: "Community & events",
    blurb: "ROMEO is far ahead here. Grindr has almost nothing; MACHOBB has none.",
    rows: [
      {
        feature: "Events & parties",
        detail: "Browse and RSVP to real-world events.",
        grindr: "no", romeo: "yes", machobb: "no", fyk: "yes",
        fykNote: "Create, edit, cancel, RSVP, capacity, content gate, attendee privacy.",
      },
      {
        feature: "Groups / clubs",
        detail: "Interest-based communities. A named ROMEO feature.",
        grindr: "no", romeo: "yes", machobb: "no", fyk: "yes",
        fykNote: "Joinable clubs with member counts and their own event feeds.",
      },
      {
        feature: "Venue & city guide",
        detail: "Curated bars, saunas, cafés and community spaces.",
        grindr: "no", romeo: "yes", machobb: "no", fyk: "yes",
        fykNote: "Guide with categories, safety notes, map pins and offline availability.",
      },
      {
        feature: "Footprints",
        detail: "Leave a lightweight compliment sticker on a profile. ROMEO's signature.",
        grindr: "no", romeo: "yes", machobb: "no", fyk: "yes",
        fykNote: "12 footprints, compliments only — no body-rating or ranking mechanics.",
      },
      {
        feature: "Visitor log",
        detail: "See who viewed your profile.",
        grindr: "premium", romeo: "premium", machobb: "premium", fyk: "yes",
        fykNote: "5 visits / 24 h free, 90 days on Plus. Incognito visits are never recorded at all.",
      },
      {
        feature: "Public photo rating / body categories",
        detail: "ROMEO's GuyCandy and picture ratings sort people by body part.",
        grindr: "no", romeo: "yes", machobb: "no", fyk: "no",
        fykNote: "Deliberately not built. Ranking people by body is the opposite of the brief.",
      },
      {
        feature: "Escort marketplace",
        detail: "ROMEO links to Hunqz.",
        grindr: "no", romeo: "yes", machobb: "no", fyk: "no",
        fykNote: "Out of scope — different product with different legal duties.",
      },
    ],
  },
  {
    id: "safety",
    title: "Safety & privacy",
    blurb: "Where FYK is built to win outright. Most of this category simply doesn't exist elsewhere.",
    rows: [
      {
        feature: "Block, report, mute",
        detail: "Baseline moderation tools.",
        grindr: "yes", romeo: "yes", machobb: "yes", fyk: "yes",
        fykNote: "Blocks cascade to grid, explore, events, visitors, search and chat.",
      },
      {
        feature: "Incognito browsing",
        detail: "Browse without leaving a trace.",
        grindr: "premium", romeo: "premium", machobb: "yes", fyk: "premium",
        fykNote: "Visits genuinely aren't written, not merely hidden at read time.",
      },
      {
        feature: "App lock PIN",
        detail: "Passcode on the app itself.",
        grindr: "yes", romeo: "partial", machobb: "partial", fyk: "yes",
        fykNote: "4–6 digits, neutral lock screen, five-minute idle timeout.",
      },
      {
        feature: "Discreet app icon",
        detail: "Disguise the app on the home screen.",
        grindr: "premium", romeo: "no", machobb: "no", fyk: "yes",
        fykNote: "Four neutral icon and name presets, free for everyone.",
      },
      {
        feature: "Approximate distance by design",
        detail: "Prevent triangulation of a home address.",
        grindr: "partial", romeo: "partial", machobb: "partial", fyk: "yes",
        fykNote: "Snap to a 250 m grid, deterministic ±0.3 km per-pair jitter, 0.5 km display floor.",
      },
      {
        feature: "Meet-up safety check-in",
        detail: "Arm a timer before a date; a trusted contact is alerted if you don't check in.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Live countdown, one-tap 'I'm fine', escalation card with your contact's details.",
      },
      {
        feature: "Scam & coercion detection",
        detail: "Warn before someone gets talked into a bad situation.",
        grindr: "partial", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Pattern pack for money asks, off-platform pressure and age ambiguity, plus the classifier.",
      },
      {
        feature: "Address-sharing interstitial",
        detail: "One-time nudge before sending an exact location.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Fires once per thread, never blocks you, offers a safer alternative.",
      },
      {
        feature: "Screenshot deterrence",
        detail: "Watermark sensitive media with the viewer's name.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Watermarked viewer, blur on tab-switch. Called deterrence, never prevention.",
      },
      {
        feature: "Travel safety mode",
        detail: "Extra shielding plus local resources when you're away from home.",
        grindr: "partial", romeo: "partial", machobb: "no", fyk: "yes",
        fykNote: "Auto-hides distance and delays online status; six countries of offline helplines.",
      },
      {
        feature: "Offline LGBTQ+ support directory",
        detail: "Crisis and community numbers that work with no signal.",
        grindr: "partial", romeo: "yes", machobb: "no", fyk: "yes",
        fykNote: "Bundled in the app payload, no network needed.",
      },
      {
        feature: "Party mode QR handoff",
        detail: "Swap profiles in person without giving out a phone number.",
        grindr: "no", romeo: "no", machobb: "partial", fyk: "yes", lead: true,
        fykNote: "Rotating QR generated locally, expires in ten minutes.",
      },
    ],
  },
  {
    id: "platform",
    title: "Platform, data & trust",
    blurb: "The unglamorous part nobody markets — and the reason people leave apps.",
    rows: [
      {
        feature: "End-to-end encrypted messages",
        detail: "The operator structurally cannot read your chats.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "ECDH P-256 key agreement, HKDF, AES-256-GCM, with comparable safety numbers.",
      },
      {
        feature: "Passkey sign-in",
        detail: "Biometric, passwordless auth with no password database to breach.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "WebAuthn against the platform authenticator — Face ID, Touch ID, Windows Hello.",
      },
      {
        feature: "GPU-accelerated search",
        detail: "Rank the whole corpus in parallel instead of filtering strings.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "WGSL compute shader over every profile vector, with a CPU fallback.",
      },
      {
        feature: "Installable PWA",
        detail: "Install from the browser, no app-store gatekeeping.",
        grindr: "no", romeo: "no", machobb: "partial", fyk: "yes",
        fykNote: "Manifest, service worker, offline shell, push and home-screen badging.",
      },
      {
        feature: "Local-first storage",
        detail: "Your data lives on your device first, not on their server first.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "IndexedDB plus the Origin Private File System, with persistent-storage opt-in.",
      },
      {
        feature: "Full data export",
        detail: "GDPR Article 20 portability.",
        grindr: "partial", romeo: "partial", machobb: "no", fyk: "yes",
        fykNote: "One-tap JSON built in the browser, including private notes.",
      },
      {
        feature: "Real account deletion",
        detail: "Hard purge, not a hidden flag.",
        grindr: "yes", romeo: "yes", machobb: "partial", fyk: "yes",
        fykNote: "Soft delete, 14-day grace, then photos, messages and caches are purged.",
      },
      {
        feature: "No third-party ad trackers",
        detail: "Grindr has been fined over data sharing; ROMEO and MACHOBB both run ads.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Zero analytics beacons, zero ad SDKs, one session cookie.",
      },
      {
        feature: "All AI runs on your device",
        detail: "No prompt or message leaves the client.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "MiniLM int8 in-tab. Disable it and deterministic fallbacks take over.",
      },
      {
        feature: "Works offline",
        detail: "Usable shell and queued actions with no connection.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Offline badge, queued sends that flush on reconnect, cached models and tiles.",
      },
      {
        feature: "Voice navigation & dictation",
        detail: "Run the whole app hands-free.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "22 commands, fuzzy matching, dictation grammar and speech read-back.",
      },
      {
        feature: "Full keyboard control",
        detail: "Command palette and complete keyboard navigation.",
        grindr: "no", romeo: "partial", machobb: "no", fyk: "yes", lead: true,
        fykNote: "⌘K palette over people, screens and actions.",
      },
      {
        feature: "Light theme",
        detail: "A real light mode, not an inverted dark one.",
        grindr: "no", romeo: "yes", machobb: "partial", fyk: "yes",
        fykNote: "Separately tuned palette that holds WCAG AA contrast.",
      },
      {
        feature: "WCAG 2.2 AA accessibility",
        detail: "Screen readers, focus rings, reduced motion, 44px targets.",
        grindr: "no", romeo: "partial", machobb: "no", fyk: "yes", lead: true,
        fykNote: "Reduced-motion honoured, labelled icon buttons, visible focus throughout.",
      },
      {
        feature: "Self-hostable, no vendor lock-in",
        detail: "Run the whole stack yourself.",
        grindr: "no", romeo: "no", machobb: "no", fyk: "yes", lead: true,
        fykNote: "SQLite + Docker Compose, OpenStreetMap tiles, no paid API anywhere.",
      },
      {
        feature: "Free tier that isn't crippled",
        detail: "MACHOBB's genuine strength — unlimited messaging free.",
        grindr: "no", romeo: "partial", machobb: "yes", fyk: "yes",
        fykNote: "Unlimited messages, unlimited profile views, no ads, no interstitials.",
      },
    ],
  },
];

export const APPS = [
  { id: "grindr", label: "Grindr", note: "~14.5 M monthly users" },
  { id: "romeo", label: "ROMEO", note: "Deepest profiles & community" },
  { id: "machobb", label: "MACHOBB", note: "Niche-first, generous free tier" },
  { id: "fyk", label: "FYK", note: "This build" },
] as const;

export function tally() {
  const counts = { grindr: 0, romeo: 0, machobb: 0, fyk: 0 };
  let total = 0;
  let leads = 0;
  for (const cat of MATRIX) {
    for (const row of cat.rows) {
      total++;
      if (row.lead) leads++;
      for (const k of ["grindr", "romeo", "machobb", "fyk"] as const) {
        const v = row[k];
        counts[k] += v === "yes" ? 1 : v === "premium" ? 0.75 : v === "partial" ? 0.5 : 0;
      }
    }
  }
  return { counts, total, leads };
}
