"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { searchPlaces, type GeocodingFeature } from "#/lib/geocoding";
import { cn } from "#/utils/cn";
import { Search, MapPin, X } from "lucide-react";

interface MapSearchBarProps {
  placeholder?: string;
  proximity?: { lat: number; lng: number };
  onSelect: (feature: GeocodingFeature) => void;
  className?: string;
  autoFocus?: boolean;
}

export function MapSearchBar({
  placeholder = "Search address...",
  proximity,
  onSelect,
  className,
  autoFocus,
}: MapSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Debounced search
  // ---------------------------------------------------------------------------
  const fetchResults = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setOpen(false);
        return;
      }

      setLoading(true);
      try {
        const features = await searchPlaces(q, proximity);
        setResults(features);
        setOpen(features.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [proximity],
  );

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (timerRef.current) clearTimeout(timerRef.current);

      if (!value.trim()) {
        setResults([]);
        setOpen(false);
        setLoading(false);
        return;
      }

      timerRef.current = setTimeout(() => {
        fetchResults(value);
      }, 300);
    },
    [fetchResults],
  );

  // ---------------------------------------------------------------------------
  // Cleanup debounce timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Click outside → close dropdown
  // ---------------------------------------------------------------------------
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---------------------------------------------------------------------------
  // Select a result
  // ---------------------------------------------------------------------------
  const handleSelect = useCallback(
    (feature: GeocodingFeature) => {
      setQuery(feature.place_name);
      setOpen(false);
      setResults([]);
      onSelect(feature);
    },
    [onSelect],
  );

  // ---------------------------------------------------------------------------
  // Clear input
  // ---------------------------------------------------------------------------
  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Input */}
      <div className="relative flex items-center">
        <Search
          size={16}
          className="absolute left-3 text-muted pointer-events-none"
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label={placeholder || "Search address"}
          aria-autocomplete="list"
          aria-controls={open ? "map-search-results" : undefined}
          aria-expanded={open}
          role="combobox"
          className={cn(
            "w-full bg-surface/95 backdrop-blur-xl border border-line rounded-xl",
            "pl-9 pr-9 py-2.5 text-sm text-primary placeholder:text-muted",
            "outline-none focus:border-gold/50 transition-colors",
          )}
        />

        {/* Loading spinner or clear button */}
        <div className="absolute right-3 flex items-center">
          {loading ? (
            <>
              <span className="sr-only">Searching...</span>
              <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-gold border-t-transparent animate-spin" />
            </>
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="text-muted hover:text-primary transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          id="map-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-surface/95 backdrop-blur-xl border border-line rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto"
        >
          {results.map((feature) => (
            <button
              key={feature.id}
              type="button"
              role="option"
              onClick={() => handleSelect(feature)}
              className="flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/20 transition-colors border-b border-line last:border-b-0"
            >
              <MapPin
                size={16}
                className="mt-0.5 shrink-0 text-gold"
              />
              <div className="min-w-0">
                <div className="text-sm text-primary truncate">
                  {feature.place_name}
                </div>
                {feature.address && (
                  <div className="text-xs text-muted truncate">
                    {feature.address}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
