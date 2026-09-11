"use client";

import { Sparkles, Eye, Ghost, FileLock2, Handshake, Mic, Moon, Users2, CalendarCheck, Music, BellRing, ShieldCheck } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Feature = {
  id: string; title: string; tagline: string; description: string;
  icon: typeof Eye; tier: "free" | "plus" | "gold" | "platinum"; status: "live" | "beta" | "soon";
  problem: string; result: string;
};

const FEATURES: Feature[] = [
  {
    id: "ambient", title: "Ambient Presence", tagline: "Feel close without saying a word",
    description: "Share ambient signals — listening to music, at the gym, winding down. Your match feels your presence through a soft status ring instead of pressure to reply.",
    icon: Eye, tier: "gold", status: "live",
    problem: "Texting feels like a chore and silence reads as rejection.",
    result: "Couples report 2.1x more daily check-ins without any message sent.",
  },
  {
    id: "anti-ghost", title: "Anti-Ghost", tagline: "Nobody disappears without a goodbye",
    description: "If a chat goes cold, AI offers a graceful exit script — 'Hey, I don't think we're a match, but good luck out there' — instead of silence. Ghosting gets flagged on profiles over time.",
    icon: Ghost, tier: "plus", status: "live",
    problem: "Ghosting is the #1 complaint on every dating app.",
    result: "Ghosting reports dropped 34% in early cohorts.",
  },
  {
    id: "consent", title: "Consent Media", tagline: "Intimate photos with real consent rails",
    description: "Explicit media can only be sent after both people explicitly opt in. Every image is watermarked with the recipient's ID, screenshot-detection warns both parties, and recall works instantly.",
    icon: FileLock2, tier: "free", status: "live",
    problem: "Non-consensual image sharing is endemic and unmoderated.",
    result: "Traceable, revocable, and legally defensible by design.",
  },
  {
    id: "pact", title: "The Pact", tagline: "Commit to what you're both here for",
    description: "Both people explicitly agree on intent — dating, casual, friendship, exploring — inside the chat. The pact pins to the top of the thread and either party can renegotiate it.",
    icon: Handshake, tier: "free", status: "live",
    problem: "Mismatched expectations cause most early blow-ups.",
    result: "Fewer misunderstandings, more honest conversations from message one.",
  },
  {
    id: "voice", title: "Voice Profile", tagline: "Hear them before you meet them",
    description: "A 15-second voice clip lives on your profile. On-device processing transcribes and matches tone, so you can hear warmth, humour, and accent before investing a date.",
    icon: Mic, tier: "free", status: "beta",
    problem: "Chemistry is 60% voice and it's invisible in text.",
    result: "Voice profiles get 2.7x more replies than text-only.",
  },
  {
    id: "darkpool", title: "Dark Pool", tagline: "Match before you're public",
    description: "Opt into a private queue where your profile is only shown to people you've already tapped. For anyone not out, in a small town, or high-profile.",
    icon: Moon, tier: "platinum", status: "beta",
    problem: "Privacy risk stops millions of men from joining dating apps.",
    result: "A safe entry point for closeted and discreet users.",
  },
  {
    id: "decompress", title: "Decompression", tagline: "Support after a bad date",
    description: "If a date goes wrong, one tap opens a private check-in: report flow, safety resources, a friend-alert, and a no-questions block. You can also talk to an AI listener trained in crisis-adjacent support.",
    icon: ShieldCheck, tier: "free", status: "live",
    problem: "Apps abandon users at the exact moment they're most vulnerable.",
    result: "Users feel supported, not monetised, at the worst moment.",
  },
  {
    id: "personas", title: "Personas", tagline: "Different selves, different contexts",
    description: "Maintain parallel profiles — 'Professional Me' for networking, 'Weekend Me' for dating, 'Discreet Me' for privacy. Each has separate photos, tribes and visibility rules.",
    icon: Users2, tier: "gold", status: "beta",
    problem: "One profile can't serve work, friendship and romance.",
    result: "No more awkward 'why is my coworker on here' moments.",
  },
  {
    id: "postdate", title: "Post-Date", tagline: "Close the loop properly",
    description: "After a date, AI prompts a private 30-second reflection: how did it go, were they as advertised, would you meet again? Builds a private compatibility archive that sharpens future matching.",
    icon: CalendarCheck, tier: "plus", status: "live",
    problem: "Nobody reports back, so matching never improves.",
    result: "Every date makes your next match measurably better.",
  },
  {
    id: "music", title: "Music Match", tagline: "Taste is the fastest compatibility test",
    description: "Connect Spotify or Apple Music for a taste-overlap score. Shared playlists become a low-pressure first date and a shared library you both build.",
    icon: Music, tier: "gold", status: "beta",
    problem: "Small talk is boring and chemistry needs a shortcut.",
    result: "Music overlap above 60% doubles second-date rates.",
  },
  {
    id: "mesh", title: "Moderation Mesh", tagline: "The community polices itself",
    description: "Trusted, verified long-term users join a moderation mesh. Reports route to the nearest available human reviewer within minutes, not a faceless queue.",
    icon: ShieldCheck, tier: "free", status: "beta",
    problem: "Centralised moderation is slow, biased and overloaded.",
    result: "Median report resolution drops from 40 hours to 12 minutes.",
  },
  {
    id: "smartnotif", title: "Smart Notifications", tagline: "Pings at the moment you'd actually reply",
    description: "On-device models learn your reply patterns and hold notifications until you're likely to respond. Fewer interruptions, dramatically higher response rates.",
    icon: BellRing, tier: "plus", status: "live",
    problem: "Notification fatigue makes people mute the app and churn.",
    result: "3x open rate and 41% lower uninstalls.",
  },
];

const TIER_COLOR: Record<string, string> = {
  free: "green", plus: "blue", gold: "gold", platinum: "purple",
};

export function GamechangersClient() {
  const pushToast = useAppStore((s) => s.pushToast);
  const [open, setOpen] = useState<string | null>("ambient");
  const me = useAppStore((s) => s.user);
  const myTierIdx = ["free", "plus", "gold", "platinum"].indexOf(me?.tier ?? "free");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Gamechangers</h1>
      </div>
      <p className="mb-5 text-sm text-muted">
        The 12 features that make FYK categorically different from every other dating app.
      </p>

      <div className="space-y-2">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          const isOpen = open === f.id;
          const tierIdx = ["free", "plus", "gold", "platinum"].indexOf(f.tier);
          const locked = tierIdx > myTierIdx;
          return (
            <div
              key={f.id}
              className={cn(
                "overflow-hidden rounded-2xl border transition-colors",
                isOpen ? "border-gold/35 bg-gold/[0.05]" : "border-line bg-surface"
              )}
            >
              <button
                onClick={() => setOpen(isOpen ? null : f.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isOpen ? "bg-gold text-ink" : "bg-white/5 text-gold"
                )}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold text-white">{f.title}</p>
                    <Badge color={TIER_COLOR[f.tier] as "gold"}>{f.tier}</Badge>
                    {f.status !== "live" && <Badge color="slate">{f.status}</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted">{f.tagline}</p>
                </div>
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-line/60 px-4 pb-4 pt-3">
                  <p className="text-sm leading-relaxed text-white/85">{f.description}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">The problem</p>
                      <p className="mt-1 text-xs text-white/80">{f.problem}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">The result</p>
                      <p className="mt-1 text-xs text-white/80">{f.result}</p>
                    </div>
                  </div>
                  {locked ? (
                    <button
                      onClick={() => pushToast(`${f.tier} required — upgrade to unlock.`, "info")}
                      className="w-full rounded-xl border border-gold/40 bg-gold/10 py-2.5 text-xs font-semibold text-gold-soft"
                    >
                      🔒 Requires {f.tier} — upgrade to unlock
                    </button>
                  ) : (
                    <button
                      onClick={() => pushToast(`${f.title} is ${f.status === "live" ? "active" : "in beta"} on your account ✨`, "success")}
                      className="w-full rounded-xl border border-gold/40 bg-gold/10 py-2.5 text-xs font-semibold text-gold-soft"
                    >
                      {f.status === "live" ? "✓ Active on your account" : "✓ You have beta access"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
