"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, MapPin, Users, Clock, Check, Plus, X, Sparkles, ArrowLeft, DollarSign } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { EventItem } from "@/lib/types";
import { EmptyState, Skeleton, Badge, Button } from "@/components/ui/primitives";
import { cn, gradient } from "@/lib/utils";
import { MEETNOW } from "@/lib/constants";
import { format } from "date-fns";

const CAT_EMOJI: Record<string, string> = {
  Gym: "🏋️", Dinner: "🍽️", Coffee: "☕", Party: "🎉",
  Movies: "🎬", Walk: "🚶", Travel: "✈️", Other: "✨",
};

export function EventsClient() {
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const [tab, setTab] = useState<"upcoming" | "mine" | "past">("upcoming");
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<EventItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => api<{ events: EventItem[] }>("/api/events").then((r) => r.events),
  });

  const rsvp = useMutation({
    mutationFn: ({ eventId, action }: { eventId: string; action: "join" | "leave" }) =>
      api("/api/events", { method: "POST", body: { eventId, action } }),
    onMutate: async ({ eventId, action }) => {
      // optimistic update
      await qc.cancelQueries({ queryKey: ["events"] });
      const prev = qc.getQueryData<{ events: EventItem[] }>(["events"]);
      if (prev) {
        qc.setQueryData(["events"], {
          events: prev.events.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  attending: action === "join" ? "going" : null,
                  attendee_count: (e.attendee_count ?? 0) + (action === "join" ? 1 : -1),
                }
              : e
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(["events"], ctx.prev); },
    onSuccess: (_d, vars) => {
      pushToast(vars.action === "join" ? "You're going! 🎉" : "RSVP cancelled", vars.action === "join" ? "success" : "info");
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const events = data ?? [];
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.start_time ?? 0).getTime() >= now);
  const past = events.filter((e) => new Date(e.start_time ?? 0).getTime() < now);

  const list = tab === "upcoming" ? upcoming : tab === "mine" ? events.filter((e) => e.isMine || e.attending) : past;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Events</h1>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-lg bg-gold px-3 text-xs font-semibold text-ink"
        >
          <Plus className="h-3.5 w-3.5" /> Create
        </button>
      </div>
      <p className="mb-4 text-sm text-muted">
        Real life is the point. Meet your community face to face.
      </p>

      <div className="mb-4 flex gap-1.5">
        {([
          ["upcoming", `Upcoming (${upcoming.length})`],
          ["mine", `My events (${events.filter((e) => e.isMine || e.attending).length})`],
          ["past", `Past (${past.length})`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              tab === k ? "border-gold/50 bg-gold/15 text-gold-soft" : "border-line bg-surface text-muted hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon="📅"
          title={tab === "mine" ? "No events yet" : tab === "past" ? "No past events" : "No upcoming events"}
          description={tab === "mine" ? "RSVP to something or host your own." : "Check back soon — the community is always planning."}
          action={tab === "mine" ? <Button onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> Create event</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {list.map((e) => {
            const full = e.max_attendees ? e.attendee_count >= e.max_attendees : false;
            return (
              <div key={e.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex flex-col sm:flex-row sm:items-stretch">
                  <div className="flex w-full shrink-0 items-center justify-center gap-2 border-b border-line bg-surface-2 px-5 py-3 sm:w-24 sm:flex-col sm:border-b-0 sm:border-r">
                    <span className="text-2xl font-bold text-gold">{e.start_time ? format(new Date(e.start_time), "d") : "—"}</span>
                    <span className="text-[11px] uppercase tracking-wide text-muted">
                      {e.start_time ? format(new Date(e.start_time), "MMM") : ""}
                    </span>
                  </div>

                  <button onClick={() => setDetail(e)} className="flex-1 p-4 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{e.name}</h3>
                      {e.category && <Badge color="purple">{CAT_EMOJI[e.category] ?? "✨"} {e.category}</Badge>}
                      {e.isMine && <Badge color="gold">hosting</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{e.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.start_time ? format(new Date(e.start_time), "EEE h:mm a") : "TBD"}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{e.attendee_count}{e.max_attendees ? `/${e.max_attendees}` : ""} going</span>
                      {e.cost > 0 && <span className="flex items-center gap-1 text-gold/70"><DollarSign className="h-3 w-3" />{e.cost}</span>}
                    </div>
                  </button>

                  <div className="flex items-center justify-end p-4 sm:flex-col sm:justify-center">
                    <button
                      onClick={() => rsvp.mutate({ eventId: e.id, action: e.attending ? "leave" : "join" })}
                      disabled={full && !e.attending}
                      className={cn(
                        "flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50",
                        e.attending
                          ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "bg-gold text-ink hover:bg-gold-soft"
                      )}
                    >
                      {e.attending ? <><Check className="h-4 w-4" /> Going</> : full ? "Full" : "RSVP"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} onRsvp={(a) => rsvp.mutate({ eventId: detail.id, action: a })} />}
      {creating && <CreateWizard onClose={() => setCreating(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------- detail */

function EventDetail({
  event, onClose, onRsvp,
}: { event: EventItem; onClose: () => void; onRsvp: (action: "join" | "leave") => void }) {
  const full = event.max_attendees ? event.attendee_count >= event.max_attendees : false;
  const countdown = event.start_time
    ? Math.max(0, Math.round((new Date(event.start_time).getTime() - Date.now()) / 86400000))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-32" style={{ background: gradient(event.name) }}>
          <button onClick={onClose} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-white backdrop-blur">
            <X className="h-5 w-5" />
          </button>
          <span className="absolute bottom-3 left-4 text-4xl">{CAT_EMOJI[event.category ?? "Other"] ?? "✨"}</span>
        </div>
        <div className="p-5">
          <h2 className="text-xl font-bold text-white">{event.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{event.start_time ? format(new Date(event.start_time), "EEE, MMM d · h:mm a") : "TBD"}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{event.attendee_count} going</span>
          </div>

          {countdown > 0 && (
            <div className="mt-3 rounded-xl border border-gold/25 bg-gold/[0.06] p-3 text-center">
              <p className="text-2xl font-bold text-gradient-gold">{countdown}</p>
              <p className="text-[11px] uppercase tracking-widest text-muted">days to go</p>
            </div>
          )}

          <p className="mt-4 text-sm leading-relaxed text-white/90">{event.description}</p>

          {event.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {event.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70">{t}</span>
              ))}
            </div>
          )}

          <Button
            className="mt-5 w-full"
            onClick={() => { onRsvp(event.attending ? "leave" : "join"); onClose(); }}
            disabled={full && !event.attending}
          >
            {event.attending ? "Cancel RSVP" : full ? "Event full" : event.cost > 0 ? `RSVP · $${event.cost}` : "RSVP"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- create wizard */

const STEPS = ["Category", "Title", "When", "Where", "Capacity", "Review"];

function CreateWizard({ onClose }: { onClose: () => void }) {
  const pushToast = useAppStore((s) => s.pushToast);
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", description: "", category: "Coffee", location: "",
    date: "", time: "18:00", max_attendees: 20, cost: 0, tags: [] as string[],
  });
  const [aiTitles, setAiTitles] = useState<string[] | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const start = form.date ? new Date(`${form.date}T${form.time}`) : new Date(Date.now() + 7 * 86400000);
      return api("/api/events", {
        method: "POST",
        body: {
          name: form.name, description: form.description, category: form.category,
          location: form.location, start_time: start.toISOString(),
          max_attendees: form.max_attendees, cost: form.cost, tags: form.tags,
          action: "create",
        },
      });
    },
    onSuccess: () => {
      pushToast("Event published! 🎉");
      qc.invalidateQueries({ queryKey: ["events"] });
      onClose();
    },
    onError: (e) => pushToast(e instanceof Error ? e.message : "Failed", "error"),
  });

  async function suggestTitles() {
    await api<{ options: string[] }>("/api/ai", {
      method: "POST", body: { action: "bioWriter" },
    }).catch(() => null);
    // fall back to locally generated ideas
    const ideas = [
      `${form.category} Night at ${form.location || "the usual spot"} ${CAT_EMOJI[form.category] ?? "✨"}`,
      `${form.category} Social — all kings welcome`,
      `Casual ${form.category.toLowerCase()} meetup 👋`,
    ];
    setAiTitles(ideas);
  }

  const valid =
    form.name.trim().length > 2 && form.description.trim().length > 10 && form.location.trim().length > 2;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Create event</h3>
          <button onClick={onClose} className="text-muted hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {/* progress */}
        <div className="mb-5 flex gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-gold" : "bg-white/10")} />
          ))}
        </div>

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>

        {step === 0 && (
          <div className="grid grid-cols-4 gap-2">
            {MEETNOW.map((c) => (
              <button
                key={c}
                onClick={() => { setForm((f) => ({ ...f, category: c })); setStep(1); }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors",
                  form.category === c ? "border-gold/50 bg-gold/15" : "border-line bg-surface-2"
                )}
              >
                <span className="text-xl">{CAT_EMOJI[c] ?? "✨"}</span>
                <span className="text-[10px] text-white/80">{c}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Event title"
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="What's happening? Who should come?"
              className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
            />
            <button onClick={suggestTitles} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 py-2 text-xs font-medium text-gold-soft">
              <Sparkles className="h-3.5 w-3.5" /> Suggest a title with AI
            </button>
            {aiTitles && (
              <div className="space-y-1.5">
                {aiTitles.map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, name: t }))}
                    className="w-full rounded-xl border border-line bg-surface-2 p-2.5 text-left text-xs text-white/80 hover:border-gold/40"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-gold/50 focus:outline-none"
            />
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-gold/50 focus:outline-none"
            />
            <div className="rounded-xl border border-gold/20 bg-gold/[0.06] p-3">
              <p className="flex items-start gap-1.5 text-[11px] text-white/80">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-gold" />
                Thursday and Sunday evenings see the highest RSVP rates in your area.
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Venue or neighbourhood"
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
            />
            <div className="space-y-1.5">
              {["Blue Bottle Coffee, Chelsea", "Bryant Park", "Hex & Co, UES", "The Crown, Midtown"].map((v) => (
                <button
                  key={v}
                  onClick={() => setForm((f) => ({ ...f, location: v }))}
                  className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2 p-2.5 text-left text-xs text-white/80 hover:border-gold/40"
                >
                  <MapPin className="h-3.5 w-3.5 text-gold" /> {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-muted">Max attendees</span>
                <span className="text-gold-soft">{form.max_attendees}</span>
              </div>
              <input
                type="range" min={5} max={100} step={5} value={form.max_attendees}
                onChange={(e) => setForm((f) => ({ ...f, max_attendees: Number(e.target.value) }))}
                className="w-full accent-gold"
              />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-muted">Cost per person ($)</span>
                <span className="text-gold-soft">${form.cost}</span>
              </div>
              <input
                type="range" min={0} max={60} step={5} value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: Number(e.target.value) }))}
                className="w-full accent-gold"
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-line bg-surface-2 p-4">
              <p className="text-2xl">{CAT_EMOJI[form.category]}</p>
              <p className="mt-1 font-semibold text-white">{form.name || "Untitled event"}</p>
              <p className="mt-1 text-xs text-muted">{form.description || "No description"}</p>
              <div className="mt-3 space-y-1 text-[11px] text-muted">
                <p><Clock className="mr-1 inline h-3 w-3" />{form.date || "Date TBD"} at {form.time}</p>
                <p><MapPin className="mr-1 inline h-3 w-3" />{form.location || "Location TBD"}</p>
                <p><Users className="mr-1 inline h-3 w-3" />Max {form.max_attendees} · ${form.cost}</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => create.mutate()} disabled={!valid || create.isPending}>
              {create.isPending ? "Publishing…" : "Publish event"}
            </Button>
            {!valid && <p className="text-center text-[11px] text-muted">Add a title, description and location to publish.</p>}
          </div>
        )}

        {step < 5 && (
          <div className="mt-5 flex gap-2">
            {step > 0 && (
              <Button variant="secondary" className="flex-1" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            {step > 0 && (
              <Button className="flex-1" onClick={() => setStep(step + 1)} disabled={step === 1 && !form.name.trim()}>
                Continue
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
