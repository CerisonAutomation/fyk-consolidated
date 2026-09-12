"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Shield, Ban, Flag, Lock, Eye, Smartphone, X, Heart, Zap, FileLock2, Handshake, Moon,
  ShieldCheck, MapPin,
} from "lucide-react";
import { FYKMap } from "#/components/map/FYKMap";
import type { MapPinItem } from "#/components/map/FYKMap";
import { useAuth } from "@/components/EntryShell";
import { useAppStore } from "@/lib/store";
import {
  listFootprints, listBlocks, unblockUser,
  listNotes, createNote, deleteNote, createCheckIn,
  listCheckIns, listEmergencyContacts, addEmergencyContact, removeEmergencyContact,
  type SafetyProfile,
} from "#/integrations/supabase/safety";
import { EmptyState, Skeleton, Button } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/Avatar";
import { cn, timeAgo } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────

const TIPS = [
  { icon: Lock, title: "Keep it on-platform", desc: "Chat on FYK until you genuinely trust someone. Off-platform requests in the first few messages are a scam signal." },
  { icon: Eye, title: "Video verify first", desc: "Look for the verified badge and suggest a quick video call before meeting in person." },
  { icon: Smartphone, title: "Meet in public", desc: "First meetings belong in busy public places. Share your live location with a friend." },
  { icon: Flag, title: "Report anything", desc: "If something feels off, report it. Our moderation mesh reviews reports around the clock." },
  { icon: FileLock2, title: "Consent media rails", desc: "Explicit media requires both people to opt in first. Every image is watermarked and revocable." },
  { icon: Handshake, title: "Set the pact early", desc: "Agree on what you're both looking for inside the chat -- before expectations mismatch." },
];

const PRESET_META: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  visited: { label: "Viewed your profile", icon: Eye, color: "text-purple-400" },
  liked: { label: "Favorited you", icon: Heart, color: "text-rose-400" },
  tapped: { label: "Tapped you", icon: Zap, color: "text-gold-soft" },
};

const SAFE_VENUE_PINS: MapPinItem[] = [
  { id: "safe-1", lat: 35.8997, lng: 14.5146, label: "Cafe Cordina, Valletta", emoji: "☕", accent: true },
  { id: "safe-2", lat: 35.8984, lng: 14.5126, label: "Palazzo Preca, Valletta", emoji: "🏛️", accent: true },
  { id: "safe-3", lat: 35.8978, lng: 14.5172, label: "Bridge Bar, Valletta", emoji: "🌉", accent: true },
  { id: "safe-4", lat: 35.9012, lng: 14.5109, label: "Legligin, Valletta", emoji: "🍽️", accent: true },
  { id: "safe-5", lat: 35.9004, lng: 14.5155, label: "LOTS Wine Bar, Valletta", emoji: "🍷", accent: true },
];

// ─── Display helpers ───────────────────────────────────────────────────────

function profileDisplay(p: SafetyProfile | null) {
  if (!p) return null;
  return {
    pseudo: p.display_name || "Anonymous",
    photoUrl: p.avatar_url,
    online: !p.hide_online && Date.now() - new Date(p.last_active_at).getTime() < 5 * 60_000,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────

export function SafetyClient() {
  const qc = useQueryClient();
  const router = useRouter();
  const pushToast = useAppStore((s) => s.pushToast);
  const setCheckIn = useAppStore((s) => s.setCheckIn);
  const checkIn = useAppStore((s) => s.checkIn);
  const resolveCheckIn = useAppStore((s) => s.resolveCheckIn);
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<"viewed" | "blocked" | "notes">("viewed");
  const [noteTarget, setNoteTarget] = useState<SafetyProfile | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  // Which emergency contact this check-in is pointed at. `null` means "whatever the
  // server calls the default one", so a contact deleted in another tab cannot leave a
  // stale uuid here that arms against nobody.
  const [contactPick, setContactPick] = useState<string | null>(null);
  const [addingContact, setAddingContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "" });

  const userId = user?.id ?? "";
  const isIncognito = profile?.incognito ?? false;

  // ── Queries ────────────────────────────────────────────────────────────

  const { data: footprints, isLoading: loadingFp } = useQuery({
    queryKey: ["footprints"],
    queryFn: () => listFootprints(userId).then((r) => (r.ok ? r.data : [])),
    enabled: !!userId,
  });

  const { data: blocked, isLoading: loadingBlocked } = useQuery({
    queryKey: ["blocks"],
    queryFn: () => listBlocks(userId).then((r) => (r.ok ? r.data : [])),
    enabled: !!userId,
  });

  const { data: notes, isLoading: loadingNotes } = useQuery({
    queryKey: ["notes"],
    queryFn: () => listNotes(userId).then((r) => (r.ok ? r.data : [])),
    enabled: !!userId,
  });

  // The contact list and the running check-in come from the server, so arming
  // survives a reload: before 0021 the only copy of the timer was in
  // `#/lib/store.ts`, which is why refreshing the page "resolved" it.
  const { data: contacts } = useQuery({
    queryKey: ["emergency-contacts"],
    queryFn: () => listEmergencyContacts(userId).then((r) => (r.ok ? r.data : [])),
    enabled: !!userId,
  });

  const { data: checkIns } = useQuery({
    queryKey: ["safety-checkins"],
    queryFn: () => listCheckIns(userId).then((r) => (r.ok ? r.data : null)),
    enabled: !!userId,
  });

  useEffect(() => {
    const active = checkIns?.active;
    if (!active || checkIn) return;
    setCheckIn({
      status: "ARMED",
      dueAt: new Date(active.due_at).getTime(),
      personId: userId,
      contactId: active.contact_id ?? "",
      contact: active.contact_name ?? "",
      place: active.place ?? "",
      checkInId: active.id,
    });
  }, [checkIns, checkIn, setCheckIn, userId]);

  // ── Mutations ──────────────────────────────────────────────────────────

  const unblock = useMutation({
    mutationFn: (targetId: string) => unblockUser(userId, targetId),
    onSuccess: () => {
      pushToast("User unblocked", "info");
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
  });

  const deleteNoteMut = useMutation({
    mutationFn: (targetId: string) => deleteNote(userId, targetId),
    onSuccess: () => {
      pushToast("Note deleted", "info");
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const saveNote = useMutation({
    mutationFn: () => createNote(userId, noteTarget!.id, noteContent),
    onSuccess: () => {
      pushToast("Note saved");
      setNoteTarget(null);
      setNoteContent("");
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const saveContact = useMutation({
    mutationFn: () =>
      addEmergencyContact(userId, {
        name: contactForm.name,
        phone: contactForm.phone || undefined,
        email: contactForm.email || undefined,
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        pushToast(r.message ?? "Could not add that contact", "error");
        return;
      }
      setContactPick(r.data.id);
      setContactForm({ name: "", phone: "", email: "" });
      setAddingContact(false);
      pushToast(`${r.data.name} will be told if you miss a check-in`, "success");
      qc.invalidateQueries({ queryKey: ["emergency-contacts"] });
    },
    onError: (err) =>
      pushToast(err instanceof Error ? err.message : "Could not add that contact", "error"),
  });

  const dropContact = useMutation({
    mutationFn: (id: string) => removeEmergencyContact(userId, id),
    onSuccess: () => {
      setContactPick(null);
      pushToast("Contact removed", "info");
      qc.invalidateQueries({ queryKey: ["emergency-contacts"] });
    },
  });

  const doCheckIn = useMutation({
    mutationFn: async () => {
      setCheckingIn(true);
      // Request browser geolocation
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });
      const { latitude, longitude } = pos.coords;
      // Default dueAt: 4 hours from now
      const dueAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
      // The contact is a row in `safety_contacts` (0021). This used to pass the
      // user's own id, which armed the timer against themselves — the copy on this
      // card promises "a trusted contact", and now the payload matches it.
      const result = await createCheckIn(
        userId,
        contactPick,
        `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        dueAt,
        { lat: latitude, lng: longitude },
      );
      if (!result.ok) throw new Error(result.message ?? "Failed to create check-in");
      return result.data;
    },
    onSuccess: (data) => {
      setCheckIn({
        status: "ARMED",
        dueAt: new Date(data.due_at).getTime(),
        personId: userId,
        contactId: data.contact_id ?? "",
        contact: data.contact_name ?? "",
        place: data.place ?? "",
        checkInId: data.id,
      });
      qc.invalidateQueries({ queryKey: ["safety-checkins"] });
      pushToast(
        data.warning ??
          (data.contactNotified
            ? "Check-in armed — your contact has been told and will be alerted if you miss it."
            : "Check-in armed. Nobody will be notified: add an emergency contact below."),
        data.contactNotified ? "success" : "warn",
      );
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Check-in failed";
      if (msg.includes("timeout") || msg.includes("denied")) {
        pushToast("Location access is required for safety check-in. Please allow location in your browser settings.", "error");
      } else {
        pushToast(msg, "error");
      }
    },
    onSettled: () => setCheckingIn(false),
  });

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Shield className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Safety Center</h1>
      </div>
      <p className="mb-4 text-sm text-muted">
        Your safety is non-negotiable. Manage visibility, blocks and private notes.
      </p>

      {/* incognito status */}
      {isIncognito && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3">
          <Moon className="h-4 w-4 shrink-0 text-purple-300" />
          <p className="text-xs text-white/85">
            <span className="font-semibold text-purple-200">Incognito is on.</span> You browse without
            appearing in anyone's footprints or grid.
          </p>
        </div>
      )}

      {/* tips */}
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {TIPS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.title} className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white">{t.title}</h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{t.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* safety check-in */}
      <div className="mb-5 rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Safety Check-in</h3>
        </div>
        <p className="mb-3 text-[11px] text-muted">
          Share your approximate location with a trusted contact before meeting someone new.
        </p>

        {/* running check-in — read back from the server, so this survives a reload */}
        {checkIn && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 p-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-gold" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                Check-in running{checkIn.contact ? ` · ${checkIn.contact}` : ""}
              </p>
              <p className="text-[11px] text-muted">
                Due {new Date(checkIn.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {checkIn.place ? ` · ${checkIn.place}` : ""}
              </p>
            </div>
            <button
              onClick={() => {
                resolveCheckIn(true);
                qc.invalidateQueries({ queryKey: ["safety-checkins"] });
              }}
              className="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
            >
              I'm safe
            </button>
          </div>
        )}

        {/* who gets told */}
        <h4 className="mb-2 text-xs font-semibold text-white/80">
          {contacts?.length ? "Tell them if I miss it" : "No emergency contact yet"}
        </h4>
        {contacts?.length ? (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {contacts.map((c) => {
              const picked = contactPick === c.id || (contactPick === null && c.is_default);
              return (
                <button
                  key={c.id}
                  onClick={() => setContactPick(c.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                    picked ? "border-gold/60 bg-gold/15 text-white" : "border-line bg-surface-2 text-muted hover:text-white",
                  )}
                >
                  {c.name}
                  {!c.notifiable && (
                    <span className="text-[10px] text-muted" title="No FYK account — their number is shown to you, but nothing can be sent to them">
                      · off-platform
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${c.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      dropContact.mutate(c.id);
                    }}
                    className="ml-0.5 text-muted hover:text-rose-300"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => setAddingContact((v) => !v)}
              className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-white"
            >
              + Add
            </button>
          </div>
        ) : (
          <p className="mb-2 text-[11px] text-muted">
            A check-in with no contact still counts down, but nobody is told when it runs
            out. Add one and it becomes an alert.
          </p>
        )}

        {(addingContact || !contacts?.length) && (
          <div className="mb-3 space-y-1.5 rounded-xl border border-line bg-surface-2 p-2.5">
            <input
              value={contactForm.name}
              onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name"
              className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-xs text-white outline-none ring-1 ring-line placeholder:text-muted focus:ring-gold/60"
            />
            <div className="flex gap-1.5">
              <input
                value={contactForm.phone}
                onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Phone"
                inputMode="tel"
                className="min-w-0 flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-white outline-none ring-1 ring-line placeholder:text-muted focus:ring-gold/60"
              />
              <input
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="Email (optional)"
                inputMode="email"
                className="min-w-0 flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-white outline-none ring-1 ring-line placeholder:text-muted focus:ring-gold/60"
              />
            </div>
            <button
              onClick={() => saveContact.mutate()}
              disabled={saveContact.isPending || contactForm.name.trim().length === 0}
              className="w-full rounded-lg bg-gold py-1.5 text-xs font-semibold text-ink transition-opacity disabled:opacity-50"
            >
              {saveContact.isPending ? "Saving..." : "Save contact"}
            </button>
            <p className="text-[10px] leading-relaxed text-muted">
              Only you see these details. A contact with an FYK account is what gets notified —
              a phone number alone stays on this screen, for whoever you call.
            </p>
          </div>
        )}
        <button
          onClick={() => doCheckIn.mutate()}
          disabled={checkingIn || doCheckIn.isPending}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
        >
          <MapPin className="h-4 w-4" />
          {checkingIn || doCheckIn.isPending ? "Requesting location..." : "Share approximate location"}
        </button>

        <h4 className="mb-2 text-xs font-semibold text-white/80">Suggested safe meeting spots</h4>
        <FYKMap
          center={{ lat: 35.8989, lng: 14.5146 }}
          zoom={13}
          height={220}
          pins={SAFE_VENUE_PINS}
          interactive={false}
          showPrivacyHalos={false}
        />
      </div>

      {/* tabs */}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ["viewed", `Who viewed (${footprints?.length ?? 0})`],
            ["blocked", `Blocked (${blocked?.length ?? 0})`],
            ["notes", `Notes (${notes?.length ?? 0})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors",
              tab === k ? "bg-gold text-ink" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Viewed tab ────────────────────────────────────────────────── */}
      {tab === "viewed" ? (
        loadingFp ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : !footprints?.length ? (
          <EmptyState icon="..." title="No profile views yet" description="As people discover you, views show up here (Gold feature)." />
        ) : (
          <div className="space-y-2">
            {footprints.map((f) => {
              const dp = profileDisplay(f.user);
              if (!dp) return null;
              const meta = PRESET_META[f.preset ?? "visited"] ?? PRESET_META.visited;
              const Icon = meta.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => router.navigate({ to: "/profile/$profileId", params: { profileId: f.visitor_id } })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition-colors hover:border-gold/30"
                >
                  <Avatar name={dp.pseudo} photoUrl={dp.photoUrl} size={44} online={dp.online} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{dp.pseudo}</p>
                    <p className={cn("flex items-center gap-1 text-[11px]", meta.color)}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">{timeAgo(f.created_at)}</span>
                </button>
              );
            })}
          </div>
        )
      ) : /* ── Blocked tab ──────────────────────────────────────────── */
      tab === "blocked" ? (
        loadingBlocked ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : !blocked?.length ? (
          <EmptyState icon="..." title="No blocked users" description="Block anyone from their profile -- instantly and silently." />
        ) : (
          <div className="space-y-2">
            {blocked.map((b) => {
              const dp = profileDisplay(b.user);
              if (!dp) return null;
              return (
                <div key={b.user.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                  <Avatar name={dp.pseudo} photoUrl={dp.photoUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{dp.pseudo}</p>
                    {b.reason && (
                      <p className="truncate text-[11px] text-muted capitalize">Reason: {b.reason}</p>
                    )}
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => unblock.mutate(b.user.id)}>
                    <Ban className="h-3.5 w-3.5" /> Unblock
                  </Button>
                </div>
              );
            })}
          </div>
        )
      ) : /* ── Notes tab ───────────────────────────────────────────── */
      loadingNotes ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : !notes?.length ? (
        <EmptyState icon="..." title="No private notes" description="Jot down reminders about people you meet -- only you ever see these." />
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const dp = profileDisplay(n.target);
            if (!dp) return null;
            return (
              <div key={n.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
                <Avatar name={dp.pseudo} photoUrl={dp.photoUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">{dp.pseudo}</p>
                    <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-white/80">{n.content}</p>
                </div>
                <button
                  onClick={() => deleteNoteMut.mutate(n.target_user_id)}
                  className="text-muted hover:text-rose-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Note modal ───────────────────────────────────────────────── */}
      {noteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
          onClick={() => setNoteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={profileDisplay(noteTarget)?.pseudo ?? ""} photoUrl={profileDisplay(noteTarget)?.photoUrl} size={40} />
              <p className="text-sm font-semibold text-white">
                Note about {profileDisplay(noteTarget)?.pseudo}
              </p>
            </div>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              placeholder="Private note (only you can see it)..."
              className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={() => saveNote.mutate()} disabled={!noteContent.trim()} className="flex-1">
                Save note
              </Button>
              <Button variant="secondary" onClick={() => setNoteTarget(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
