/**
 * Grid Entity — Core Domain — Hexagonal Architecture
 * Compared to Grindr: location-first grid, distance, online, fresh, filters
 * Compared to Romeo: 120+ search options, grid view options, travel mode
 * Compared to MachoBB: tribe-specific, private media, never share exact location
 */

export type GridFilterId = string & { readonly brand: unique symbol };

export interface GridProfile {
  id: string;
  type: 'rendered' | 'lazy';
  displayName: string | null;
  age: number | null;
  photoUrl: string | null;
  photos: string[];
  distance: number | null; // meters, hidden if privacy
  onlineUntil: number | null; // timestamp
  isNew: boolean; // fresh
  isFavorite: boolean;
  isBoosted: boolean;
  isVerified: boolean; // MachoBB: selfie verification, Grindr: verification badge
  compatibilityScore: number | null; // 0-100
  position: string | null;
  tribes: string[];
  interests: string[];
  headline: string | null;
  unread: number | null;
  lastSeen: number | null;
  geo: {
    lat: number;
    lng: number;
    geohash: string;
    hidden: boolean; // Romeo: hide real GPS, MachoBB: never share exact
  } | null;
  privacy: {
    hideDistance: boolean;
    hideOnline: boolean;
    ghostMode: boolean;
  };
  boost: {
    active: boolean;
    expiresAt: number | null;
    multiplier: number;
  } | null;
  verification: {
    status: 'verified' | 'unverified' | 'pending';
    badge: boolean;
    selfieVerified: boolean; // MachoBB: selfie verification
  };
}

export interface GridFilters {
  // Basic
  ageEnabled: boolean;
  age: [number, number];
  genderEnabled: boolean;
  genders: string[];
  positionEnabled: boolean;
  positions: string[];
  distanceEnabled: boolean;
  distance: [number, number]; // km
  
  // Appearance
  bodyTypesEnabled: boolean;
  bodyTypes: string[];
  heightEnabled: boolean;
  height: [number, number];
  weightEnabled: boolean;
  weight: [number, number];
  tribesEnabled: boolean;
  tribes: string[];
  photosEnabled: boolean;
  photos: string[]; // photo filters
  
  // Lifestyle
  relationshipStatusesEnabled: boolean;
  relationshipStatuses: string[];
  lookingForEnabled: boolean;
  lookingFor: string[];
  meetAtEnabled: boolean;
  meetAt: string[];
  tagsEnabled: boolean;
  tags: string[];
  healthPracticesEnabled: boolean;
  healthPractices: string[];
  
  // Activity
  isOnline: boolean; // Grindr: online now
  isFavorite: boolean;
  isNew: boolean; // fresh
  hasPhoto: boolean; // photo only
  isVerified: boolean; // verified only
  isBoosted: boolean;
  haventChattedTodayEnabled: boolean;
  acceptNSFWPicsEnabled: boolean;
  
  // Advanced (Romeo: 120+ options)
  languages: string[];
  interests: string[];
  lastSeen: 'now' | 'today' | 'week' | 'month' | 'any';
  sortBy: 'distance' | 'online' | 'new' | 'compatibility' | 'random';
  sortOrder: 'asc' | 'desc';
}

export interface GridState {
  items: GridProfile[];
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  page: number;
  filters: GridFilters;
  geohash: string | null;
  scrollY: number;
  viewMode: 'grid' | 'map' | 'list'; // Romeo: grid view options
  travelMode: {
    active: boolean;
    destination: string | null;
    arrivalDate: Date | null; // Romeo: appear 2 weeks prior
    geohash: string | null;
  } | null;
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Haversine formula
  const R = 6371e3; // meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

export function sortGridProfiles(profiles: GridProfile[], filters: GridFilters, _userLocation: { lat: number; lng: number } | null): GridProfile[] {
  // _userLocation reserved for travel mode 2 weeks prior (Romeo) + future distance recalc
  return [...profiles].sort((a, b) => {
    switch (filters.sortBy) {
      case 'distance':
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return filters.sortOrder === 'asc' ? a.distance - b.distance : b.distance - a.distance;
      case 'online':
        const aOnline = a.onlineUntil && a.onlineUntil > Date.now() ? 1 : 0;
        const bOnline = b.onlineUntil && b.onlineUntil > Date.now() ? 1 : 0;
        return bOnline - aOnline;
      case 'new':
        return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      case 'compatibility':
        return (b.compatibilityScore ?? 0) - (a.compatibilityScore ?? 0);
      case 'random':
        return Math.random() - 0.5;
      default:
        // Multi-factor: distance 30% + compatibility 25% + online 20% + recency 15% + verification 10%
        const aScore = (a.distance ? 1 / (1 + a.distance / 1000) : 0) * 0.3 +
                      (a.compatibilityScore ?? 0) / 100 * 0.25 +
                      (a.onlineUntil && a.onlineUntil > Date.now() ? 1 : 0) * 0.2 +
                      (a.isNew ? 1 : 0) * 0.15 +
                      (a.isVerified ? 1 : 0) * 0.1;
        const bScore = (b.distance ? 1 / (1 + b.distance / 1000) : 0) * 0.3 +
                      (b.compatibilityScore ?? 0) / 100 * 0.25 +
                      (b.onlineUntil && b.onlineUntil > Date.now() ? 1 : 0) * 0.2 +
                      (b.isNew ? 1 : 0) * 0.15 +
                      (b.isVerified ? 1 : 0) * 0.1;
        return bScore - aScore;
    }
  });
}

export function filterGridProfiles(profiles: GridProfile[], filters: GridFilters): GridProfile[] {
  return profiles.filter(profile => {
    if (filters.isOnline && !(profile.onlineUntil && profile.onlineUntil > Date.now())) return false;
    if (filters.isFavorite && !profile.isFavorite) return false;
    if (filters.isNew && !profile.isNew) return false;
    if (filters.hasPhoto && !profile.photoUrl) return false;
    if (filters.isVerified && !profile.isVerified) return false;
    if (filters.isBoosted && !profile.isBoosted) return false;
    if (filters.ageEnabled && profile.age) {
      if (profile.age < filters.age[0] || profile.age > filters.age[1]) return false;
    }
    if (filters.tribesEnabled && filters.tribes.length > 0) {
      if (!profile.tribes.some(t => filters.tribes.includes(t))) return false;
    }
    if (filters.distanceEnabled && profile.distance != null) {
      const distanceKm = profile.distance / 1000;
      if (distanceKm < filters.distance[0] || distanceKm > filters.distance[1]) return false;
    }
    return true;
  });
}
