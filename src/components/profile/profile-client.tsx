"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil, Check, X, MapPin, Ruler, Sparkles, Save, Crown, Camera,
  Images, Trash2, ShieldCheck, TrendingUp,
} from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import type { ProfileUser, AlbumItem } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Button, Spinner, EmptyState } from "@/components/ui/primitives";
import {
  TRIBES, LOOKING_FOR, POSITIONS, BODY_TYPES, LANGUAGES, TAG_CATEGORIES,
} from "@/lib/constants";
import { cn, gradient } from "@/lib/utils";

const PHOTO_POOL = [
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&q=80",
  "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=800&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
  "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
];

function Chip({
  options, selected, onToggle, max,
}: { options: readonly string[]; selected: string[]; onToggle: (v: string) => void; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        const atMax = Boolean(max) && selected.length >= (max as number) && !active;
        return (
          <button
            key={opt}
            onClick={() => !atMax && onToggle(opt)}
            disabled={atMax}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40",
              active ? "border-gold/50 bg-gold/15 text-gold-soft" : "border-line bg-surface-2 text-muted hover:text-white"
            )}
          >
            {active && "✓ "}{opt}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, children, hint, action }: { title: string; children: React.ReactNode; hint?: string; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ProfileClient() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const pushToast = useAppStore((s) => s.pushToast);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [bioOptions, setBioOptions] = useState<string[] | null>(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [ranked, setRanked] = useState<{ url: string; score: number; tags: string[] }[] | null>(null);

  const { data: albums } = useQuery({
    queryKey: ["albums"],
    queryFn: () => api<{ albums: AlbumItem[] }>("/api/social?view=albums").then((r) => r.albums),
  });

  const [form, setForm] = useState({
    pseudo: user?.pseudo ?? "",
    description: user?.description ?? "",
    occupation: user?.occupation ?? "",
    age: user?.age ?? null,
    height: user?.height ?? null,
    weight: user?.weight ?? null,
    bodyType: user?.bodyType ?? "",
    position: user?.position ?? [],
    languages: user?.languages ?? [],
    lookingFor: user?.lookingFor ?? [],
    interests: user?.interests ?? [],
    tribes: user?.tribes ?? [],
    photos: user?.photos ?? [],
  });

  // sync when the user loads
  useEffect(() => {
    if (!user) return;
    setForm({
      pseudo: user.pseudo, description: user.description ?? "",
      occupation: user.occupation ?? "", age: user.age, height: user.height,
      weight: user.weight, bodyType: user.bodyType ?? "",
      position: user.position, languages: user.languages,
      lookingFor: user.lookingFor, interests: user.interests,
      tribes: user.tribes, photos: user.photos,
    });
  }, [user?.id]);

  const save = useMutation({
    mutationFn: () => api<{ profile: ProfileUser }>("/api/profile", { method: "PUT", body: form }),
    onSuccess: (res) => {
      setUser(res.profile);
      setEditing(false);
      pushToast("Profile saved ✓");
      qc.invalidateQueries({ queryKey: ["discover"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  function toggle(key: keyof typeof form, value: string) {
    setForm((f) => {
      const cur = f[key] as string[];
      return { ...f, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    });
  }

  async function generateBio() {
    setBioLoading(true);
    try {
      const r = await api<{ options: string[] }>("/api/ai", {
        method: "POST",
        body: { action: "bioWriter", pseudo: form.pseudo, occupation: form.occupation, interests: form.interests, tribes: form.tribes, lookingFor: form.lookingFor, age: form.age },
      });
      setBioOptions(r.options);
    } catch { pushToast("AI unavailable", "error"); }
    finally { setBioLoading(false); }
  }

  async function rankPhotos() {
    try {
      const r = await api<{ ranked: { url: string; score: number; tags: string[] }[] }>("/api/ai", {
        method: "POST", body: { action: "photoRanker", photos: form.photos },
      });
      setRanked(r.ranked);
    } catch { pushToast("Could not rank photos", "error"); }
  }

  if (!user) return null;

  const completion = Math.round(
    ((form.pseudo ? 1 : 0) +
      (form.description && form.description.length > 20 ? 1 : 0) +
      (form.age ? 1 : 0) +
      (form.photos.length >= 3 ? 1 : form.photos.length > 0 ? 0.5 : 0) +
      (form.tribes.length > 0 ? 1 : 0) +
      (form.interests.length >= 3 ? 1 : 0) +
      (form.lookingFor.length > 0 ? 1 : 0) +
      (form.bodyType ? 1 : 0) +
      (form.height ? 1 : 0) +
      (form.languages.length > 0 ? 1 : 0)) * 10
  ) || 0;

  return (
    <div className="mx-auto max-w-2xl">
      {/* hero */}
      <div className="mb-4 overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="relative h-40" style={{ background: gradient(form.pseudo || "FYK") }}>
          {form.photos[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photos[0]} alt="" className="h-full w-full object-cover opacity-70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
        </div>
        <div className="relative px-5 pb-5">
          <div className="-mt-12 mb-3 flex items-end justify-between">
            <div className="rounded-full border-4 border-surface">
              <Avatar name={user.pseudo} photoUrl={form.photos[0]} size={88} online={user.online} />
            </div>
            <Button
              variant={editing ? "primary" : "secondary"}
              size="sm"
              onClick={() => (editing ? save.mutate() : setEditing(true))}
              disabled={save.isPending}
            >
              {editing ? (save.isPending ? <Spinner className="border-ink/40 border-t-ink" /> : <Save className="h-4 w-4" />) : <Pencil className="h-4 w-4" />}
              {editing ? "Save" : "Edit"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{user.pseudo}</h1>
            {user.verified && <Badge color="gold"><ShieldCheck className="h-3 w-3" /> Verified</Badge>}
            <Badge color="purple">{user.tier}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {user.age && <span>{user.age} years</span>}
            {user.geo?.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{user.geo.city}</span>}
          </div>

          {/* completion */}
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted">Profile completion</span>
              <span className="font-semibold text-gold-soft">{completion}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-all duration-500" style={{ width: `${completion}%` }} />
            </div>
            {completion < 100 && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-gold/70">
                <TrendingUp className="h-3 w-3" />
                {completion < 60 ? "Add 3+ photos and interests — completed profiles get 3x more taps." : "Almost there — a few more fields unlock full visibility."}
              </p>
            )}
          </div>
        </div>
      </div>

      {!editing ? (
        <div className="space-y-3">
          <Section title="About">{form.description ? (
            <p className="text-sm leading-relaxed text-white/90">{form.description}</p>
          ) : (
            <p className="text-sm text-muted">No bio yet. Tap Edit to write one — or let AI draft it.</p>
          )}</Section>

          <Section title={`Photos (${form.photos.length})`} action={
            <button onClick={() => setEditing(true)} className="text-xs text-gold hover:text-gold-soft">
              Manage
            </button>
          }>
            {form.photos.length === 0 ? (
              <EmptyState icon="📸" title="No photos" description="Profiles with 3+ photos get 2.4x more taps." />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {form.photos.map((p: string, i: number) => (
                  <div key={i} className="relative overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="aspect-square w-full object-cover" />
                    {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-ink">MAIN</span>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {albums && albums.length > 0 && (
            <Section title="Albums" hint="Public albums are visible to everyone; secret albums need your approval.">
              <div className="grid grid-cols-2 gap-2">
                {albums.map((a) => (
                  <div key={a.id} className="overflow-hidden rounded-xl border border-line">
                    {a.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.cover_url} alt={a.name} className="h-20 w-full object-cover" />
                    ) : (
                      <div className="flex h-20 items-center justify-center bg-surface-2"><Images className="h-5 w-5 text-muted" /></div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-white">{a.name}</p>
                      <p className="text-[10px] text-muted">{a.photo_count} photos · {a.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {form.interests.length > 0 && (
            <Section title="Interests">
              <div className="flex flex-wrap gap-1.5">
                {form.interests.map((i: string) => (
                  <span key={i} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/80">{i}</span>
                ))}
              </div>
            </Section>
          )}

          <Section title="Details">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {form.height && <div className="flex items-center gap-2 text-muted"><Ruler className="h-4 w-4 text-gold" /> {form.height} cm</div>}
              {form.bodyType && <div className="flex items-center gap-2 text-muted"><Crown className="h-4 w-4 text-gold" /> {form.bodyType}</div>}
              {form.occupation && <div className="flex items-center gap-2 text-muted"><Sparkles className="h-4 w-4 text-gold" /> {form.occupation}</div>}
              {form.languages.length > 0 && <div className="flex items-center gap-2 text-muted">🌐 {form.languages.join(", ")}</div>}
            </div>
          </Section>

          {form.tribes.length > 0 && (
            <Section title="Tribes">
              <div className="flex flex-wrap gap-1.5">{form.tribes.map((t: string) => <Badge key={t} color="purple">{t}</Badge>)}</div>
            </Section>
          )}
          {form.lookingFor.length > 0 && (
            <Section title="Looking for">
              <div className="flex flex-wrap gap-1.5">
                {form.lookingFor.map((l: string) => (
                  <span key={l} className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs text-gold-soft">{l}</span>
                ))}
              </div>
            </Section>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* photos editor */}
          <Section
            title={`Photos (${form.photos.length}/6)`}
            hint="Your first photo is your main one. Drag order matters."
            action={
              <div className="flex gap-1.5">
                <button onClick={rankPhotos} className="text-[11px] text-gold hover:text-gold-soft">AI rank</button>
                <button onClick={() => setShowPhotoPicker(true)} className="text-[11px] text-gold hover:text-gold-soft">Add</button>
              </div>
            }
          >
            {form.photos.length === 0 ? (
              <button
                onClick={() => setShowPhotoPicker(true)}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line py-8 text-muted hover:border-gold/40"
              >
                <Camera className="h-6 w-6" />
                <span className="text-xs">Add your first photo</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {form.photos.map((p: string, i: number) => (
                  <div key={i} className="group relative overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="aspect-square w-full object-cover" />
                    {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-ink">MAIN</span>}
                    <button
                      onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_: string, x: number) => x !== i) }))}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-rose-400 backdrop-blur"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    {i > 0 && (
                      <button
                        onClick={() => setForm((f) => {
                          const next = [...f.photos];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return { ...f, photos: next };
                        })}
                        className="absolute bottom-1 left-1 rounded-full bg-ink/70 px-1.5 py-0.5 text-[9px] text-white backdrop-blur"
                      >
                        ← move
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {ranked && (
              <div className="mt-3 space-y-1.5 rounded-xl border border-gold/20 bg-gold/[0.06] p-3">
                <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-gold-soft">
                  <Sparkles className="h-3 w-3" /> AI photo ranking
                </p>
                {ranked.map((r, i) => (
                  <div key={r.url} className="flex items-center gap-2">
                    <span className={cn("w-4 text-[11px] font-bold", i === 0 ? "text-gold" : "text-muted")}>#{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url} alt="" className="h-8 w-8 rounded object-cover" />
                    <span className="flex-1 text-[11px] text-white/80">{r.score}/100 · {r.tags.join(", ")}</span>
                    {r.url !== form.photos[0] && (
                      <button
                        onClick={() => setForm((f) => ({ ...f, photos: [r.url, ...f.photos.filter((x: string) => x !== r.url)] }))}
                        className="text-[10px] text-gold"
                      >
                        make main
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Basics">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Display name</label>
                <input
                  value={form.pseudo}
                  onChange={(e) => setForm((f) => ({ ...f, pseudo: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-gold/50 focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">Bio</label>
                  <button onClick={generateBio} disabled={bioLoading} className="text-[11px] text-gold hover:text-gold-soft disabled:opacity-50">
                    {bioLoading ? "Writing…" : "✨ Write with AI"}
                  </button>
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                  maxLength={500}
                  placeholder="Tell your story…"
                  className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
                />
                <p className="mt-1 text-right text-[10px] text-muted">{form.description.length}/500</p>
                {bioOptions && (
                  <div className="mt-2 space-y-1.5">
                    {bioOptions.map((b, i) => (
                      <button
                        key={i}
                        onClick={() => { setForm((f) => ({ ...f, description: b })); setBioOptions(null); }}
                        className="w-full rounded-xl border border-gold/25 bg-gold/[0.06] p-2.5 text-left text-xs text-white/85 hover:border-gold/50"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([["age", "Age"], ["height", "Height (cm)"], ["weight", "Weight (kg)"]] as const).map(([k, label]) => (
                  <div key={k}>
                    <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
                    <input
                      type="number"
                      value={(form[k] as number | null) ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [k]: Number(e.target.value) || null }))}
                      className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-gold/50 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Occupation</label>
                <input
                  value={form.occupation}
                  onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
                  placeholder="What do you do?"
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
                />
              </div>
            </div>
          </Section>

          <Section title="Body type">
            <Chip options={BODY_TYPES} selected={form.bodyType ? [form.bodyType] : []}
              onToggle={(v) => setForm((f) => ({ ...f, bodyType: f.bodyType === v ? "" : v }))} />
          </Section>
          <Section title="Tribes" hint="Up to 3 — your primary tribe drives discovery.">
            <Chip options={TRIBES} selected={form.tribes} onToggle={(v) => toggle("tribes", v)} max={3} />
          </Section>
          <Section title="Position">
            <Chip options={POSITIONS} selected={form.position} onToggle={(v) => toggle("position", v)} />
          </Section>
          <Section title="Looking for">
            <Chip options={LOOKING_FOR} selected={form.lookingFor} onToggle={(v) => toggle("lookingFor", v)} />
          </Section>
          <Section title="Languages">
            <Chip options={LANGUAGES} selected={form.languages} onToggle={(v) => toggle("languages", v)} />
          </Section>
          {Object.entries(TAG_CATEGORIES).map(([catName, tags]: [string, string[]]) => (
            <Section key={catName} title={catName}>
              <Chip options={tags} selected={form.interests} onToggle={(v) => toggle("interests", v)} max={15} />
            </Section>
          ))}

          <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl border border-line bg-surface/95 p-2 backdrop-blur md:bottom-4">
            <Button onClick={() => save.mutate()} className="flex-1" disabled={save.isPending}>
              {save.isPending ? <Spinner className="border-ink/40 border-t-ink" /> : <Check className="h-4 w-4" />}
              Save profile
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {showPhotoPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4" onClick={() => setShowPhotoPicker(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Choose photos</h3>
              <button onClick={() => setShowPhotoPicker(false)} className="text-muted hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PHOTO_POOL.map((p) => {
                const selected = form.photos.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => setForm((f) => ({
                      ...f,
                      photos: selected ? f.photos.filter((x: string) => x !== p) : f.photos.length >= 6 ? f.photos : [...f.photos, p],
                    }))}
                    className={cn(
                      "relative overflow-hidden rounded-xl border-2 transition-colors",
                      selected ? "border-gold" : "border-transparent hover:border-line"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="aspect-square w-full object-cover" />
                    {selected && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-ink">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted">Tap to add or remove. Max 6 photos.</p>
          </div>
        </div>
      )}
    </div>
  );
}
