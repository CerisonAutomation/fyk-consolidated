/**
 * Maps candidate/profile objects to MapPinItems for FYKMap display.
 * Each pin is fuzzed with fuzzPin() for privacy — no exact coordinates shown.
 */

import { fuzzPin, pairHash } from "@/lib/geo";
import type { MapPinItem } from "./FYKMap";

interface Candidate {
  id: string;
  displayName?: string;
  name?: string;
  age?: number;
  photoUrl?: string;
  photos?: string[];
  distance?: number;
  online?: boolean;
  matchScore?: number;
  geo?: { lat: number; lng: number };
}

/**
 * Convert an array of candidates to fuzzed map pins.
 * Requires a viewerId for deterministic per-pair jitter.
 */
export function candidatesToPins(
  candidates: Candidate[],
  viewerId: string,
  cityCenter?: { lat: number; lng: number },
): MapPinItem[] {
  const center = cityCenter ?? { lat: 35.8989, lng: 14.5146 }; // Valletta default

  return candidates
    .filter((c) => c.geo || c.distance != null)
    .map((c) => {
      const raw = c.geo ?? {
        lat: center.lat + (Math.random() - 0.5) * 0.02,
        lng: center.lng + (Math.random() - 0.5) * 0.02,
      };
      const hash = pairHash(viewerId, c.id);
      const fuzzed = fuzzPin(raw, String(hash), c.id);

      return {
        id: c.id,
        lat: fuzzed.lat,
        lng: fuzzed.lng,
        label: c.displayName ?? c.name ?? `User ${c.id}`,
        photo: c.photoUrl ?? c.photos?.[0],
        online: c.online,
        accent: (c.matchScore ?? 0) > 80,
      };
    });
}
