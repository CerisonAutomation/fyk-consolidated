"use client";

import { lazy, Suspense, useState, useMemo, useCallback } from "react";
import {
  MapPin, Heart, Star, Clock, DollarSign, X, Search,
  Navigation,
} from "lucide-react";
import { CURATED_VENUES, VENUE_CATEGORIES, type Venue, type VenueCategory } from "@/data/venues";
import type { MapPinItem } from "@/components/MapView";
const MapView = lazy(() => import("@/components/MapView").then(m => ({ default: m.MapView })));
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { cn, gradient } from "@/lib/utils";

// ── Favorites hook (localStorage) ───────────────────────────────────────

function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("fyk:venue-favorites") ?? "[]");
    } catch {
      return [];
    }
  });

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev, id];
      try {
        localStorage.setItem("fyk:venue-favorites", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const isFav = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, toggle, isFav };
}

// ── Main component ──────────────────────────────────────────────────────

export function VenueGuideClient() {
  const { favorites, toggle, isFav } = useFavorites();
  const [category, setCategory] = useState<VenueCategory | "all" | "saved">("all");
  const [search, setSearch] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const filtered = useMemo(() => {
    let list = CURATED_VENUES;
    if (category === "saved") {
      list = list.filter((v) => favorites.includes(v.id));
    } else if (category !== "all") {
      list = list.filter((v) => v.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.city.toLowerCase().includes(q) ||
          v.tags.some((t) => t.includes(q))
      );
    }
    return list;
  }, [category, search, favorites]);

  const mapPins: MapPinItem[] = useMemo(
    () =>
      filtered.map((v) => ({
        id: v.id,
        lat: v.lat,
        lng: v.lng,
        label: v.name,
        sub: v.city,
        accent: isFav(v.id),
      })),
    [filtered, isFav]
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xl">🗺️</span>
        <h1 className="text-xl font-bold text-white">Venue Guide</h1>
      </div>
      <p className="mb-4 text-sm text-muted">
        Curated spots across Malta — bars, restaurants, gyms, and more.
      </p>

      {/* Search + View Toggle */}
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venues..."
            className="w-full rounded-xl border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors",
            viewMode === "map"
              ? "border-gold/50 bg-gold/15 text-gold"
              : "border-line bg-surface-2 text-muted hover:text-white"
          )}
        >
          <Navigation className="h-4 w-4" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setCategory("all")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            category === "all"
              ? "border-gold/50 bg-gold/15 text-gold-soft"
              : "border-line bg-surface text-muted hover:text-white"
          )}
        >
          All
        </button>
        <button
          onClick={() => setCategory("saved")}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            category === "saved"
              ? "border-rose-500/50 bg-rose-500/15 text-rose-300"
              : "border-line bg-surface text-muted hover:text-white"
          )}
        >
          <Heart className={cn("mr-1 inline h-3 w-3", category === "saved" && "fill-current")} />
          Saved ({favorites.length})
        </button>
        {(Object.keys(VENUE_CATEGORIES) as VenueCategory[]).map((key) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              category === key
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-line bg-surface text-muted hover:text-white"
            )}
          >
            {VENUE_CATEGORIES[key].emoji} {VENUE_CATEGORIES[key].label}
          </button>
        ))}
      </div>

      {/* Content */}
      {viewMode === "map" ? (
        <div className="mb-4">
          <Suspense fallback={<div className="flex items-center justify-center rounded-2xl border border-line bg-surface-2" style={{ height: 400 }}><span className="text-sm text-muted">Loading map...</span></div>}>
            <MapView
              city="valletta"
              pins={mapPins}
              height={400}
              onSelect={(id) => {
                const v = CURATED_VENUES.find((x) => x.id === id);
                if (v) setSelectedVenue(v);
              }}
            />
          </Suspense>
          <p className="mt-2 text-center text-[11px] text-muted">
            {filtered.length} venue{filtered.length !== 1 ? "s" : ""} shown · tap a pin for details
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📍"
          title="No venues found"
          description={
            category === "saved"
              ? "You have not saved any venues yet."
              : "Try adjusting your search or filters."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => (
            <VenueCard
              key={v.id}
              venue={v}
              isFav={isFav(v.id)}
              onToggleFav={() => toggle(v.id)}
              onSelect={() => setSelectedVenue(v)}
            />
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      {selectedVenue && (
        <VenueDetailSheet
          venue={selectedVenue}
          isFav={isFav(selectedVenue.id)}
          onToggleFav={() => toggle(selectedVenue.id)}
          onClose={() => setSelectedVenue(null)}
        />
      )}
    </div>
  );
}

// ── Venue Card ──────────────────────────────────────────────────────────

function VenueCard({
  venue,
  isFav,
  onToggleFav,
  onSelect,
}: {
  venue: Venue;
  isFav: boolean;
  onToggleFav: () => void;
  onSelect: () => void;
}) {
  const catMeta = VENUE_CATEGORIES[venue.category];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div
        className="h-1"
        style={{
          background: "linear-gradient(90deg, var(--c-gold, #d4a017) 0%, transparent 100%)",
        }}
      />

      <div className="flex">
        <button onClick={onSelect} className="flex-1 p-4 text-left">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{
                background: `linear-gradient(135deg, rgba(212,160,23,0.15), rgba(212,160,23,0.05))`,
              }}
            >
              {catMeta.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold text-white">{venue.name}</h3>
                <Badge color="slate">{catMeta.label}</Badge>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <MapPin className="h-3 w-3" />
                {venue.address}, {venue.city}
              </p>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-gold" fill="currentColor" />
                  {venue.rating}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {venue.priceLevel}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {venue.hours.split(",")[0]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {venue.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/60"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-start p-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav();
            }}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              isFav
                ? "bg-rose-500/15 text-rose-400"
                : "bg-surface-2 text-muted hover:text-rose-400"
            )}
            aria-label={isFav ? "Remove from saved" : "Save venue"}
          >
            <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Venue Detail Sheet ──────────────────────────────────────────────────

function VenueDetailSheet({
  venue,
  isFav,
  onToggleFav,
  onClose,
}: {
  venue: Venue;
  isFav: boolean;
  onToggleFav: () => void;
  onClose: () => void;
}) {
  const catMeta = VENUE_CATEGORIES[venue.category];

  const detailPins: MapPinItem[] = [
    {
      id: venue.id,
      lat: venue.lat,
      lng: venue.lng,
      label: venue.name,
      sub: venue.city,
      accent: true,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/85 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="relative h-36" style={{ background: gradient(venue.name) }}>
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/60 text-white backdrop-blur"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-4">
            <span className="text-4xl">{catMeta.emoji}</span>
          </div>
        </div>

        <div className="p-5">
          {/* Title + fav */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{venue.name}</h2>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <MapPin className="h-3.5 w-3.5" />
                {venue.address}, {venue.city}
              </p>
            </div>
            <button
              onClick={onToggleFav}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                isFav
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-surface-2 text-muted hover:text-rose-400"
              )}
            >
              <Heart className={cn("h-5 w-5", isFav && "fill-current")} />
            </button>
          </div>

          {/* Rating + Price + Hours */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-gold" fill="currentColor" />
              {venue.rating} rating
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {venue.priceLevel}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {venue.hours}
            </span>
          </div>

          {/* Description */}
          <p className="mt-4 text-sm leading-relaxed text-white/90">
            {venue.description}
          </p>

          {/* Tags */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {venue.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/70"
              >
                {t}
              </span>
            ))}
          </div>

          {/* Mini Map */}
          <div className="mt-4">
            <Suspense fallback={<div className="flex items-center justify-center rounded-2xl border border-line bg-surface-2" style={{ height: 200 }}><span className="text-sm text-muted">Loading map...</span></div>}>
              <MapView
                city="valletta"
                pins={detailPins}
                height={200}
                interactive={false}
              />
            </Suspense>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
                window.open(url, "_blank", "noopener");
              }}
            >
              <Navigation className="h-4 w-4" /> Directions
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
