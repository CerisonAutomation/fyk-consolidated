"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  X, Heart, Zap, Sparkles, MapPin, Ruler, MessageSquare, Flag, Shield,
  Check, StickyNote, Calendar, Weight, Briefcase, Languages,
} from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { Candidate } from "@/lib/types";
import { Button, Badge, Skeleton, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type MatchBarProps = { label: string; value: number };

function MatchBar({ label, value }: MatchBarProps) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="text-gold-soft">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ProfileModal({
  candidate,
  onClose,
  onTap,
  onFavorite,
  onMessage,
  isTapped,
}: {
  candidate: Candidate;
  onClose: () => void;
  onTap: () => void;
  onFavorite: () => void;
  onMessage?: () => void;
  isTapped: boolean;
}) {
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [tab, setTab] = useState<"about" | "compatibility" | "ai">("about");
  const [icebreakers, setIcebreakers] = useState<string[] | null>(null);
  const [loadingIce, setLoadingIce] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [dateIdeas, setDateIdeas] = useState<string[][] | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  const { data: analysis } = useQuery({
    queryKey: ["profileAnalysis", candidate.id],
    queryFn: () =>
      api<{ score: number; strengths: string[]; gaps: string[]; tips: string[] }>("/api/ai", {
        method: "POST", body: { action: "profileAnalysis", targetId: candidate.id },
      }),
    enabled: tab === "ai",
  });

  async function loadIcebreakers() {
    setLoadingIce(true);
    try {
      const r = await api<{ icebreakers: string[] }>("/api/ai", {
        method: "POST", body: { action: "icebreakers", targetId: candidate.id },
      });
      setIcebreakers(r.icebreakers);
    } catch { pushToast("AI is warming up — try again", "error"); }
    finally { setLoadingIce(false); }
  }

  async function loadDates() {
    try {
      const r = await api<{ ideas: string[][] }>("/api/ai", {
        method: "POST", body: { action: "datePlanner", interests: candidate.interests, budget: "low" },
      });
      setDateIdeas(r.ideas);
    } catch { pushToast("Could not plan dates", "error"); }
  }

  const reportMutation = useMutation({
    mutationFn: (reason: string) =>
      api("/api/safety/reports", { method: "POST", body: { reportedId: candidate.id, reason } }),
    onSuccess: () => { pushToast("Report submitted. Our team reviews 24/7.", "info"); setShowReport(false); },
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      api("/api/notes", { method: "POST", body: { targetId: candidate.id, content: note } }),
    onSuccess: () => {
      pushToast("Private note saved 📝");
      setShowNote(false); setNote("");
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const d = candidate.dimensions;

  if (!d) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl animate-in sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="relative h-60 shrink-0 sm:h-72">
          {candidate.photos?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={candidate.photos[0]} alt={candidate.pseudo} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-surface-2" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-white backdrop-blur"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="text-2xl font-bold text-white">{candidate.pseudo}</h2>
                  {candidate.verified && <Badge color="gold">✓ Verified</Badge>}
                  <Badge color="purple">{candidate.tier}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>{candidate.age ?? "—"} yrs</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{candidate.distanceKm}km · {candidate.geo?.city}</span>
                  {candidate.height && <span className="flex items-center gap-1"><Ruler className="h-3 w-3" />{candidate.height}cm</span>}
                  <span>{candidate.views_count} views</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-3xl font-bold leading-none text-gradient-gold">{candidate.matchScore}%</div>
                <div className="text-[10px] text-muted">AI match</div>
              </div>
            </div>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-line px-4 pt-3">
          {(["about", "compatibility", "ai"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative px-3 py-2 text-sm font-medium capitalize transition-colors",
                tab === t ? "text-gold-soft" : "text-muted hover:text-white"
              )}
            >
              {t === "ai" ? "AI tools" : t}
              {tab === t && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gold" />}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {tab === "about" && (
            <>
              <p className="text-sm leading-relaxed text-white/90">{candidate.description || "No bio yet."}</p>

              {candidate.photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {candidate.photos.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={p} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                {candidate.bodyType && <Detail icon={<Weight className="h-3.5 w-3.5" />} label={candidate.bodyType} />}
                {candidate.occupation && <Detail icon={<Briefcase className="h-3.5 w-3.5" />} label={candidate.occupation} />}
                {candidate.languages.length > 0 && <Detail icon={<Languages className="h-3.5 w-3.5" />} label={candidate.languages.join(", ")} />}
                {candidate.relationshipStatus && <Detail icon={<Heart className="h-3.5 w-3.5" />} label={candidate.relationshipStatus} />}
                <Detail icon={<Shield className="h-3.5 w-3.5" />} label={`Trust ${candidate.trustScore}/100`} />
              </div>

              {candidate.tribes.length > 0 && (
                <Section title="Tribes">
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.tribes.map((t) => <Badge key={t} color="purple">{t}</Badge>)}
                  </div>
                </Section>
              )}

              {candidate.interests.length > 0 && (
                <Section title="Interests">
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.interests.map((i) => (
                      <span key={i} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/80">{i}</span>
                    ))}
                  </div>
                </Section>
              )}

              {candidate.lookingFor.length > 0 && (
                <Section title="Looking for">
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.lookingFor.map((l) => (
                      <span key={l} className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs text-gold-soft">{l}</span>
                    ))}
                  </div>
                </Section>
              )}

              {candidate.position.length > 0 && (
                <Section title="Position">
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.position.map((p) => <Badge key={p} color="blue">{p}</Badge>)}
                  </div>
                </Section>
              )}

              {candidate.tagCodes.length > 0 && (
                <Section title="Tags">
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.tagCodes.map((t) => (
                      <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">{t}</span>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          {tab === "compatibility" && (
            <>
              <Section title="5-dimension compatibility">
                <div className="space-y-2.5">
                  <MatchBar label="Shared interests" value={d.interests} />
                  <MatchBar label="Lifestyle & tribes" value={d.lifestyle} />
                  <MatchBar label="Communication" value={d.communication} />
                  <MatchBar label="Goals alignment" value={d.goals} />
                  <MatchBar label="Chemistry" value={d.chemistry} />
                </div>
              </Section>
              <div className="flex items-start gap-2 rounded-2xl border border-gold/20 bg-gold/[0.06] p-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-xs leading-relaxed text-white/80">
                  Based on shared interests, goals, tribes and age proximity. Recalculated whenever either of you updates a profile.
                </p>
              </div>
            </>
          )}

          {tab === "ai" && (
            <>
              {/* icebreakers */}
              <Section
                title="AI icebreakers"
                action={
                  <button onClick={loadIcebreakers} disabled={loadingIce} className="text-xs text-gold hover:text-gold-soft disabled:opacity-50">
                    {icebreakers ? "Regenerate" : "Generate"}
                  </button>
                }
              >
                {loadingIce ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
                  </div>
                ) : icebreakers ? (
                  <div className="space-y-2">
                    {icebreakers.map((msg, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          navigator.clipboard?.writeText(msg);
                          setCopied(msg);
                          setTimeout(() => setCopied(null), 1500);
                        }}
                        className={cn(
                          "flex w-full items-start justify-between gap-2 rounded-xl border p-3 text-left text-sm transition-colors",
                          copied === msg ? "border-gold/50 bg-gold/10 text-gold-soft" : "border-line bg-surface text-white/80 hover:border-gold/30"
                        )}
                      >
                        <span>{msg}</span>
                        <span className="shrink-0 text-[10px] text-muted">{copied === msg ? "Copied" : "Copy"}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">Generate 5 openers personalised to {candidate.pseudo}&apos;s profile.</p>
                )}
              </Section>

              {/* date planner */}
              <Section
                title="AI date planner"
                action={
                  <button onClick={loadDates} className="text-xs text-gold hover:text-gold-soft">
                    {dateIdeas ? "Refresh" : "Plan"}
                  </button>
                }
              >
                {dateIdeas ? (
                  <div className="space-y-2">
                    {dateIdeas.map(([title, why], i) => (
                      <div key={i} className="rounded-xl border border-line bg-surface p-3">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-white">
                          <Calendar className="h-3.5 w-3.5 text-gold" /> {title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{why}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">Date ideas matched to their interests and your budget.</p>
                )}
              </Section>

              {/* profile analysis */}
              <Section title="Profile analysis">
                {!analysis ? (
                  <div className="flex items-center justify-center py-4"><Spinner /></div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="text-muted">Profile strength</span>
                        <span className="text-gold-soft">{analysis.score}/100</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft" style={{ width: `${analysis.score}%` }} />
                      </div>
                    </div>
                    {analysis.strengths.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">Strengths</p>
                        {analysis.strengths.map((s) => (
                          <p key={s} className="flex items-start gap-1.5 text-xs text-white/80"><Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />{s}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>

        {/* actions */}
        <div className="shrink-0 border-t border-line p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <Button onClick={onTap} disabled={isTapped} className="flex-1">
              <Zap className="h-4 w-4" /> {isTapped ? "Tapped!" : "Tap to Chat"}
            </Button>
            {onMessage && (
              <Button variant="secondary" onClick={onMessage} className="flex-1">
                <MessageSquare className="h-4 w-4" /> Message
              </Button>
            )}
            <button
              onClick={onFavorite}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                candidate.isFavorite ? "border-rose-500/40 bg-rose-500/10 text-rose-400" : "border-line bg-surface-2 text-muted hover:text-rose-400"
              )}
            >
              <Heart className={cn("h-4 w-4", candidate.isFavorite && "fill-rose-400")} />
            </button>
            <button
              onClick={() => setShowNote((s) => !s)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted hover:text-gold"
            >
              <StickyNote className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowReport((s) => !s)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted hover:text-rose-400"
            >
              <Flag className="h-4 w-4" />
            </button>
          </div>

          {showNote && (
            <div className="mt-3 rounded-xl border border-gold/25 bg-gold/[0.06] p-3">
              <p className="mb-2 text-xs font-medium text-gold-soft">Private note about {candidate.pseudo}</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Only you can see this…"
                className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
              />
              <Button size="sm" className="mt-2 w-full" onClick={() => noteMutation.mutate()} disabled={!note.trim() || noteMutation.isPending}>
                Save note
              </Button>
            </div>
          )}

          {showReport && (
            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="mb-2 text-xs font-medium text-rose-300">Report {candidate.pseudo}</p>
              <div className="flex flex-wrap gap-1.5">
                {["Harassment", "Spam", "Fake Profile", "Inappropriate", "Underage", "Other"].map((r) => (
                  <button
                    key={r}
                    onClick={() => reportMutation.mutate(r)}
                    className="rounded-full border border-rose-500/30 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted">
      <span className="text-gold">{icon}</span>
      <span className="truncate text-white/80">{label}</span>
    </div>
  );
}
