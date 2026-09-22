/**
 * Anti-Spoofer Checks — 11.3, 12.6
 * Detect mocked/fake GPS providers, enumerate mock-location apps.
 */

export type SpoofCheckResult = {
  isSpoofed: boolean;
  confidence: number;
  reasons: string[];
  mockApps?: string[];
  shouldWarn: boolean;
  shouldBlock: boolean;
};

export type LocationSample = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  mocked?: boolean;
  provider?: string;
};

const KNOWN_MOCK_APPS = [
  "com.lexa.fakegps",
  "com.blogspot.newapphorizons.fakegps",
  "com.incorporateapps.fakegps",
  "com.rosteam.gpsemulator",
  "org.hola.gpslocation",
  "com.fakegps.mock",
];

export function detectMockLocation(samples: LocationSample[]): SpoofCheckResult {
  const reasons: string[] = [];
  let spoofScore = 0;

  // Check for mocked flag (Android)
  const mockedCount = samples.filter((s) => s.mocked).length;
  if (mockedCount > 0) {
    spoofScore += 80;
    reasons.push(`mocked_flag:${mockedCount}`);
  }

  // Check for unrealistic jumps (teleportation)
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const distance = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
    const timeDiff = (curr.timestamp - prev.timestamp) / 1000; // seconds
    const speedKmh = timeDiff > 0 ? (distance / timeDiff) * 3600 : 0;

    // > 500 km/h is suspicious (faster than plane)
    if (speedKmh > 500) {
      spoofScore += 30;
      reasons.push(`teleport:${distance.toFixed(1)}km_in_${timeDiff}s`);
    }
  }

  // Check for perfect accuracy (mock often reports 0 or very low)
  const perfectAccuracy = samples.filter((s) => s.accuracy === 0 || s.accuracy < 1).length;
  if (perfectAccuracy > samples.length * 0.5) {
    spoofScore += 20;
    reasons.push("perfect_accuracy");
  }

  // Check for repeated identical coordinates
  const uniqueCoords = new Set(samples.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`));
  if (uniqueCoords.size === 1 && samples.length > 3) {
    spoofScore += 15;
    reasons.push("identical_coords");
  }

  spoofScore = Math.min(100, spoofScore);
  const isSpoofed = spoofScore >= 50;

  return {
    isSpoofed,
    confidence: spoofScore,
    reasons,
    shouldWarn: spoofScore >= 30,
    shouldBlock: spoofScore >= 80,
  };
}

export function detectMockApps(installedApps: string[]): { found: string[]; isSuspicious: boolean } {
  const found = installedApps.filter((app) => KNOWN_MOCK_APPS.some((mock) => app.toLowerCase().includes(mock.toLowerCase()) || mock.includes(app.toLowerCase())));

  return {
    found,
    isSuspicious: found.length > 0,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function shouldFlagUser(result: SpoofCheckResult): boolean {
  return result.isSpoofed && result.confidence >= 60;
}
