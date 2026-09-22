/**
 * User Entity — Core Domain — Hexagonal Architecture
 * Central entity for all user-related logic
 * Compared to Grindr/Romeo/MachoBB: unified user model with verification, tribes, privacy
 */

export type UserId = string & { readonly brand: unique symbol };
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type OnlineStatus = 'online' | 'offline' | 'away' | 'invisible';
export type PrivacyLevel = 'public' | 'friends' | 'private';

export interface User {
  id: UserId;
  email: string;
  displayName: string;
  age: number | null;
  bio: string | null;
  photoUrl: string | null;
  photos: string[];
  verificationStatus: VerificationStatus;
  onlineStatus: OnlineStatus;
  lastSeenAt: Date | null;
  location: {
    lat: number;
    lng: number;
    geohash: string;
    city: string | null;
    country: string | null;
    hidden: boolean; // Romeo: hide real GPS, Grindr: hide distance
  } | null;
  tribes: string[]; // Romeo: tribes, MachoBB: tribes
  interests: string[];
  lookingFor: string[];
  position: string | null;
  bodyType: string | null;
  height: number | null;
  weight: number | null;
  relationshipStatus: string | null;
  pronouns: string | null;
  languages: string[];
  healthPractices: string[];
  tags: string[];
  isNew: boolean;
  isBoosted: boolean;
  isFavorite: boolean;
  isBlocked: boolean;
  isHidden: boolean;
  compatibilityScore: number | null;
  distance: number | null; // meters
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  userId: UserId;
  showDistance: boolean; // Grindr: hide distance
  showOnline: boolean;
  showAge: boolean;
  ghostMode: boolean; // Romeo: appear offline, Grindr: incognito
  hideProfileVisits: boolean; // Romeo: hide visits
  allowScreenshot: boolean; // Grindr: screenshot blocking
  discreetIcon: boolean; // App icon hiding
  autoTranslate: boolean; // Grindr: chat translation
  language: string;
  units: 'metric' | 'imperial';
  notifications: {
    messages: boolean;
    taps: boolean;
    views: boolean;
    nearby: boolean;
    marketing: boolean;
  };
}

export interface UserStats {
  userId: UserId;
  viewsTotal: number;
  viewsToday: number;
  likesReceived: number;
  likesGiven: number;
  matches: number;
  messagesSent: number;
  messagesReceived: number;
  replyRate: number; // 0-100
  avgResponseTime: number; // minutes
  profileCompleteness: number; // 0-100
  bestPhoto: string | null;
  onlineHours: number;
  streak: number; // days
}

export function createUserId(id: string): UserId {
  return id as UserId;
}

export function isUserOnline(user: User, thresholdMs = 5 * 60 * 1000): boolean {
  if (user.onlineStatus === 'invisible') return false;
  if (user.onlineStatus === 'online') return true;
  if (!user.lastSeenAt) return false;
  return Date.now() - user.lastSeenAt.getTime() < thresholdMs;
}

export function canViewProfile(viewer: User | null, target: User, prefs: UserPreferences): boolean {
  if (target.isBlocked) return false;
  if (target.isHidden) return false;
  if (prefs.ghostMode && viewer?.id !== target.id) return false;
  return true;
}

export function calculateProfileCompleteness(user: User): number {
  let score = 0;
  const checks = [
    !!user.displayName,
    !!user.bio,
    !!user.photoUrl,
    user.photos.length >= 3,
    user.tribes.length > 0,
    user.interests.length > 0,
    user.lookingFor.length > 0,
    !!user.age,
    !!user.location,
    user.languages.length > 0,
  ];
  score = (checks.filter(Boolean).length / checks.length) * 100;
  return Math.round(score);
}
