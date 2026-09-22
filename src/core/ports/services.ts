/**
 * Service Ports — Hexagonal Architecture
 * Interfaces for external services, implemented by adapters
 */

// Geocoding Service Port (Romeo: travel, Grindr: Explore)
export interface GeocodingService {
  geocode(address: string): Promise<{ lat: number; lng: number; city: string | null; country: string | null } | null>;
  reverseGeocode(lat: number, lng: number): Promise<{ city: string | null; country: string | null; address: string | null } | null>;
  getGeohash(lat: number, lng: number, precision: number): string;
  getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number; // meters
}

// Translation Service Port (Grindr: chat translation, on-device)
export interface TranslationService {
  translate(text: string, from: string, to: string): Promise<string>;
  detectLanguage(text: string): Promise<string>;
  getSupportedLanguages(): Promise<string[]>;
  translateBatch(texts: string[], from: string, to: string): Promise<string[]>;
}

// Push Notification Service Port
export interface PushService {
  send(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<void>;
  sendBulk(userIds: string[], title: string, body: string, data?: Record<string, unknown>): Promise<void>;
  subscribe(userId: string, subscription: PushSubscription): Promise<void>;
  unsubscribe(userId: string, endpoint: string): Promise<void>;
}

// SMS Service Port (Emergency share)
export interface SMSService {
  send(to: string, message: string): Promise<{ id: string; status: string }>;
  sendLocation(to: string, lat: number, lng: number, place: string | null, message: string | null, expiresAt: Date): Promise<{ id: string }>;
}

// Email Service Port
export interface EmailService {
  send(to: string, subject: string, html: string, text?: string): Promise<void>;
  sendVerification(to: string, code: string): Promise<void>;
  sendPasswordReset(to: string, token: string): Promise<void>;
}

// Storage Service Port (Photos, private albums)
export interface StorageService {
  upload(file: File | Buffer, path: string, options?: { private?: boolean; expiring?: boolean; expiresAt?: Date }): Promise<{ url: string; key: string }>;
  delete(key: string): Promise<void>;
  getUrl(key: string, expiresIn?: number): Promise<string>;
  createPrivateAlbum(userId: string, name: string): Promise<{ id: string }>;
  addToAlbum(albumId: string, photoKey: string): Promise<void>;
  grantAlbumAccess(albumId: string, userId: string, expiresAt?: Date): Promise<void>;
}

// AI Service Port (Rizz, photo enhance, compatibility)
export interface AIService {
  generateText(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string>;
  analyzeImage(imageUrl: string): Promise<{ quality: number; lighting: number; blur: number; smile: number; background: number; appeal: number; safe: boolean }>;
  enhanceImage(imageUrl: string, options?: { fixLighting?: boolean; fixBlur?: boolean }): Promise<{ enhancedUrl: string; scores: Record<string, number> }>;
  detectCatfish(photoUrl: string, referencePhotos: string[]): Promise<{ isCatfish: boolean; confidence: number; reason: string | null }>;
  generateIcebreaker(profile: unknown, vibe: string): Promise<string[]>;
  scoreRizz(message: string, context: string[]): Promise<{ score: number; feedback: string }>;
}

// Verification Service Port (MachoBB: selfie verification, Grindr: verification badge)
export interface VerificationService {
  requestVerification(userId: string, photos: string[]): Promise<{ id: string; status: string }>;
  verifySelfie(userId: string, selfieUrl: string): Promise<{ verified: boolean; confidence: number }>;
  getVerificationStatus(userId: string): Promise<{ status: string; verifiedAt: Date | null }>;
}

// Moderation Service Port
export interface ModerationService {
  moderateText(text: string): Promise<{ safe: boolean; categories: string[]; score: number }>;
  moderateImage(imageUrl: string): Promise<{ safe: boolean; categories: string[]; score: number }>;
  reportContent(reporterId: string, targetId: string, reason: string, details?: string): Promise<{ id: string }>;
  blockUser(userId: string, blockedId: string, reason?: string): Promise<void>;
}

// Analytics Service Port
export interface AnalyticsService {
  track(event: string, properties?: Record<string, unknown>, userId?: string): Promise<void>;
  trackScreen(screen: string, userId?: string): Promise<void>;
  identify(userId: string, traits?: Record<string, unknown>): Promise<void>;
}

// Combined Services Port
export interface Services {
  geocoding: GeocodingService;
  translation: TranslationService;
  push: PushService;
  sms: SMSService;
  email: EmailService;
  storage: StorageService;
  ai: AIService;
  verification: VerificationService;
  moderation: ModerationService;
  analytics: AnalyticsService;
}
