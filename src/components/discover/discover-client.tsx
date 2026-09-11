"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Compass, Sparkles, SlidersHorizontal, LayoutGrid, Map as MapIcon, RotateCcw, X } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import { useVectorSearch } from "@/hooks/use-vector-search";
import type { Candidate } from "@/lib/types";
import { Skeleton, EmptyState, Button } from "@/components/ui/primitives";
import { ProfileCard } from "@/components/discover/profile-card";
import { ProfileModal } from "@/components/discover/profile-modal";
import { StoriesRail } from "@/components/discover/stories-rail";
import { cn } from "@/lib/utils";
import { TRIBES, LOOKING_FOR, BODY_TYPES, MEETNOW } from "@/lib/constants";

type Filters = {
  tribe: string; looking: string; body: string; intent: string;
  minAge: number; maxAge: number; maxDistance: number;
  onlineOnly: boolean; verifiedOnly: boolean; minMatch: number;
};

const DEFAULTS: Filters = {
  tribe: "All", looking: "All", body: "All", intent: "All",
  minAge: 18, maxAge: 60, maxDistance: 50, onlineOnly: false, verifiedOnly: false, minMatch: 0,
};

export function DiscoverClient() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useAppStore((s) => s.user);
  const pushToast = useAppStore((s) => s.pushToast);
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [showFilters, setShowFilters] = useState(false);
  const [mode, setMode] = useState<"grid" | "map">("grid");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [tapped, setTapped] = useState<string[]>([]);

  // --- Vector search: GPU-accelerated similarity for profile ranking ---
  const vectorQuery = useMemo(() => {
    if (!me) return "";
    const parts = [
      me.pseudo, me.description, me.city, me.occupation,
      ...(me.interests || []), ...(me.tribes || []), ...(me.lookingFor || []),
    ].filter(Boolean);
    return parts.join(" ");
  }, [me]);

  const vectorResults = useVectorSearch(vectorQuery, {
    enabled: vectorQuery.length >= 2,
    matchCount: 30,
    threshold: 0.3,
  });

  // Build a Map of profile_id -> similarity score from vector results
  const vectorScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of vectorResults.data) {
      map.set(r.profile_id, r.similarity);
    }
    return map;
  }, [vectorResults.data]);

  const { data, isLoading } = useQuery({
    queryKey: ["discover"],
    queryFn: () => api<{ candidates: Candidate[]; meta: { online: number; verified: number; newCount: number; vibes: { vibe: string; count: number }[] } }>("/api/discover"),
  });

  const tapMutation = useMutation({
    mutationFn: (targetId: string) =>
      api<{ isMatch: boolean }>("/api/taps", { method: "POST", body: { targetId } }),
    onSuccess: (res, targetId) => {
      setTapped((p) => [...p, targetId]);
      pushToast(res.isMatch ? "It's a match! ✨ You tapped each other" : "Tap sent 👑", res.isMatch ? "info" : "success");
      qc.invalidateQueries({ queryKey: ["discover"] });
      qc.invalidateQueries({ queryKey: ["taps"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const favMutation = useMutation({
    mutationFn: (targetId: string) =>
      api<{ favorited: boolean }>("/api/social", { method: "POST", body: { action: "favorite", targetId } }),
    onSuccess: (res) => {
      pushToast(res.favorited ? "Added to favorites ❤️" : "Removed from favorites", res.favorited ? "success" : "info");
      qc.invalidateQueries({ queryKey: ["discover"] });
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const trackView = useMutation({
    mutationFn: (targetId: string) =>
      api("/api/discover", { method: "POST", body: { targetId } }),
  });

  const all = data?.candidates ?? [];
  const meta = data?.meta;

  const candidates = useMemo(() => {
    return all
      .filter((c) => {
        if (filters.tribe !== "All" && !c.tribes.includes(filters.tribe)) return false;
        if (filters.looking !== "All" && !c.lookingFor.includes(filters.looking)) return false;
        if (filters.body !== "All" && c.bodyType !== filters.body) return false;
        if (filters.intent !== "All" && !c.intents.includes(filters.intent)) return false;
        if (c.age && (c.age < filters.minAge || c.age > filters.maxAge)) return false;
        if (c.distanceKm > filters.maxDistance) return false;
        if (filters.onlineOnly && !c.online) return false;
        if (filters.verifiedOnly && !c.verified) return false;
        if (c.matchScore < filters.minMatch) return false;
        return true;
      })
      .map((c) => {
        const similarity = vectorScores.get(c.id);
        // Similarity >= 0.6 from cosine distance = strong semantic match
        const isAiRecommended = similarity != null && similarity >= 0.6;
        return { ...c, vectorSimilarity: similarity, isAiRecommended } as Candidate & {
          vectorSimilarity?: number;
          isAiRecommended: boolean;
        };
      });
  }, [all, filters, vectorScores]);

  const activeFilterCount =
    (filters.tribe !== "All" ? 1 : 0) + (filters.looking !== "All" ? 1 : 0) +
    (filters.body !== "All" ? 1 : 0) + (filters.intent !== "All" ? 1 : 0) +
    (filters.onlineOnly ? 1 : 0) + (filters.verifiedOnly ? 1 : 0) +
    (filters.minMatch > 0 ? 1 : 0) + (filters.maxDistance < 50 ? 1 : 0);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Compass className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-foreground">Discover</h1>
        <span className="ml-auto flex gap-1">
          <button
            onClick={() => setMode(mode === "grid" ? "map" : "grid")}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[11px] text-muted transition-colors hover:text-foreground"
          >
            {mode === "grid" ? <MapIcon className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
            {mode === "grid" ? "Map" : "Grid"}
          </button>
          <button
            onClick={() => setShowFilters(true)}
            className={cn(
              "relative flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors",
              activeFilterCount > 0
                ? "border-gold/40 bg-gold/10 text-gold-soft"
                : "border-line bg-surface text-muted hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-ink">
                {activeFilterCount}
              </span>
            )}
          </button>
        </span>
      </div>

      {/* AI smart-defaults strip */}
      <div className="mb-3 flex items-start gap-2 rounded-2xl border border-gold/20 bg-gold/[0.06] p-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <p className="text-xs leading-relaxed text-foreground/80">
          <span className="font-semibold text-gold-soft">AI smart defaults active.</span>{" "}
          Showing {candidates.length} kings ranked by 5-dimension compatibility.
          {vectorScores.size > 0 && (
            <> <span className="text-purple-300">Vector search boosted {vectorScores.size} profiles.</span></>
          )}
          {meta && meta.newCount > 0 && <> <span className="text-foreground">{meta.newCount} are new to you.</span></>}
        </p>
      </div>

      <StoriesRail />

      {/* quick chips */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={filters.onlineOnly} onClick={() => setFilters((f) => ({ ...f, onlineOnly: !f.onlineOnly }))}>
          🟢 Online now {meta ? `(${meta.online})` : ""}
        </Chip>
        <Chip active={filters.verifiedOnly} onClick={() => setFilters((f) => ({ ...f, verifiedOnly: !f.verifiedOnly }))}>
          ✓ Verified {meta ? `(${meta.verified})` : ""}
        </Chip>
        {TRIBES.slice(0, 6).map((t) => (
          <Chip key={t} active={filters.tribe === t} onClick={() => setFilters((f) => ({ ...f, tribe: f.tribe === t ? "All" : t }))}>
            {t}
          </Chip>
        ))}
        {(meta?.vibes ?? []).slice(0, 3).map((v) => (
          <Chip key={v.vibe} active={filters.intent === v.vibe} onClick={() => setFilters((f) => ({ ...f, intent: f.intent === v.vibe ? "All" : v.vibe }))}>
            {v.vibe} energy
          </Chip>
        ))}
      </div>

      {mode === "map" ? (
        <MapView candidates={candidates} onSelect={(c) => { setSelected(c); trackView.mutate(c.id); }} me={me} />
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No kings match those filters"
          description="Try loosening your filters — or widen your distance radius."
          action={
            <Button variant="secondary" onClick={() => setFilters(DEFAULTS)}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {candidates.map((c) => (
            <ProfileCard
              key={c.id}
              candidate={c}
              isTapped={tapped.includes(c.id)}
              onTap={() => tapMutation.mutate(c.id)}
              onFavorite={() => favMutation.mutate(c.id)}
              onOpen={() => { setSelected(c); trackView.mutate(c.id); }}
              isAiRecommended={(c as any).isAiRecommended}
            />
          ))}
        </div>
      )}

      {selected && (
        <ProfileModal
          candidate={selected}
          onClose={() => setSelected(null)}
          onTap={() => tapMutation.mutate(selected.id)}
          onFavorite={() => favMutation.mutate(selected.id)}
          onMessage={async () => {
            const r = await api<{ conversationId: string }>("/api/conversations", {
              method: "POST", body: { targetId: selected.id },
            });
            // `/messages` is not a route; the chat screen is keyed by conversation.
            navigate({ to: "/chat/$conversationId", params: { conversationId: r.conversationId } });
          }}
          isTapped={tapped.includes(selected.id)}
        />
      )}

      {showFilters && (
        <FilterSheet
          filters={filters}
          onChange={setFilters}
          onClose={() => setShowFilters(false)}
          onReset={() => setFilters(DEFAULTS)}
          count={candidates.length}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-gold/50 bg-gold/15 text-gold-soft"
          : "border-line bg-surface text-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- map view */

function MapView({
  candidates, onSelect, me,
}: { candidates: Candidate[]; onSelect: (c: Candidate) => void; me: { geo: { lat: number; lng: number; city: string } | null } | null }) {
  const withGeo = candidates.filter((c) => c.geo);
  if (withGeo.length === 0)
    return <EmptyState icon="🗺️" title="No locations to show" description="Nobody nearby has location enabled." />;

  // project lat/lng to a simple equirectangular grid
  const lats = withGeo.map((c) => c.geo!.lat);
  const lngs = withGeo.map((c) => c.geo!.lng);
  const myLat = me?.geo?.lat ?? null;
  const myLng = me?.geo?.lng ?? null;
  if (myLat !== null) lats.push(myLat);
  if (myLng !== null) lngs.push(myLng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.05;
  const lngSpan = maxLng - minLng || 0.05;
  const pad = 0.02;
  const pos = (lat: number, lng: number) => ({
    top: `${100 - ((lat - minLat + pad) / (latSpan + pad * 2)) * 100}%`,
    left: `${((lng - minLng + pad) / (lngSpan + pad * 2)) * 100}%`,
  });

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-[#0d1117] sm:aspect-[16/10]">
      {/* grid lines for a "dark map tile" feel */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(#223 1px, transparent 1px), linear-gradient(90deg, #223 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gold/[0.04]" />

      {me?.geo && myLat !== null && myLng !== null && (
        <>
          <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={pos(myLat, myLng)}>
            <div className="h-4 w-4 rounded-full border-2 border-white bg-gold pulse-glow" />
          </div>
          <span className="absolute left-3 top-3 z-10 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] text-foreground/80 backdrop-blur">
            You · {me.geo.city}
          </span>
        </>
      )}

      {withGeo.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={pos(c.geo!.lat, c.geo!.lng)}
        >
          <div className="relative">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-transform group-hover:scale-125",
                c.online ? "border-emerald-400" : "border-white/40"
              )}
              style={{ background: `linear-gradient(135deg,#2a2a35,#15151d)` }}
            >
              {c.pseudo.slice(0, 2).toUpperCase()}
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-1 text-[9px] font-semibold text-gold-soft">
              {c.matchScore}
            </span>
            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-foreground shadow-lg group-hover:block">
              {c.pseudo} · {c.distanceKm}km
            </div>
          </div>
        </button>
      ))}

      <div className="absolute bottom-3 right-3 z-10 rounded-full bg-ink/70 px-2.5 py-1 text-[10px] text-foreground/70 backdrop-blur">
        {withGeo.length} kings plotted
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- filter sheet */

function FilterSheet({
  filters, onChange, onClose, onReset, count,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
  onReset: () => void;
  count: number;
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    onChange({ ...filters, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Filters</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          <Range label="Age" min={filters.minAge} max={filters.maxAge} absMin={18} absMax={70}
            onChange={(min, max) => { set("minAge", min); set("maxAge", max); }} />

          <div>
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-muted">Max distance</span>
              <span className="text-gold-soft">{filters.maxDistance} km</span>
            </div>
            <input
              type="range" min={1} max={50} value={filters.maxDistance}
              onChange={(e) => set("maxDistance", Number(e.target.value))}
              className="w-full accent-gold"
            />
          </div>

          <div>
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-muted">Min AI match</span>
              <span className="text-gold-soft">{filters.minMatch}%</span>
            </div>
            <input
              type="range" min={0} max={100} step={5} value={filters.minMatch}
              onChange={(e) => set("minMatch", Number(e.target.value))}
              className="w-full accent-gold"
            />
          </div>

          <Select label="Tribe" value={filters.tribe} options={["All", ...TRIBES]} onChange={(v) => set("tribe", v)} />
          <Select label="Looking for" value={filters.looking} options={["All", ...LOOKING_FOR]} onChange={(v) => set("looking", v)} />
          <Select label="Body type" value={filters.body} options={["All", ...BODY_TYPES]} onChange={(v) => set("body", v)} />
          <Select label="Intent" value={filters.intent} options={["All", ...MEETNOW, ...TRIBES]} onChange={(v) => set("intent", v)} />

          <div className="flex gap-2">
            <Toggle label="Online only" value={filters.onlineOnly} onChange={(v) => set("onlineOnly", v)} />
            <Toggle label="Verified only" value={filters.verifiedOnly} onChange={(v) => set("verifiedOnly", v)} />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Show {count} kings
          </Button>
        </div>
      </div>
    </div>
  );
}

function Range({
  label, min, max, absMin, absMax, onChange,
}: { label: string; min: number; max: number; absMin: number; absMax: number; onChange: (min: number, max: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="text-gold-soft">{min}–{max}</span>
      </div>
      <div className="flex items-center gap-2">
        <input type="range" min={absMin} max={absMax} value={min}
          onChange={(e) => onChange(Math.min(Number(e.target.value), max - 1), max)}
          className="w-full accent-gold" />
        <input type="range" min={absMin} max={absMax} value={max}
          onChange={(e) => onChange(min, Math.max(Number(e.target.value), min + 1))}
          className="w-full accent-gold" />
      </div>
    </div>
  );
}

function Select({
  label, value, options, onChange,
}: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-gold/50 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o === "All" ? `All ${label.toLowerCase()}s` : o}</option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "flex-1 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors",
        value ? "border-gold/50 bg-gold/15 text-gold-soft" : "border-line bg-surface-2 text-muted"
      )}
    >
      {value && "✓ "}{label}
    </button>
  );
}
