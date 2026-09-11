import type { LatLng } from "../domain/types";

export interface LocationService {
  getCurrentPosition(): Promise<LatLng | null>;
  watchPosition(callback: (pos: LatLng) => void): () => void;
  geocodeCity(city: string): Promise<LatLng | null>;
  haversineKm(a: LatLng, b: LatLng): number;
  approximatePosition(id: string, distMi: number, center?: LatLng): LatLng;
}

export interface CryptoService {
  generateIdentity(): Promise<{ publicKey: string; privateKey: CryptoKey }>;
  deriveKey(privateKey: CryptoKey, publicKeyRaw: string, conversationId: string): Promise<CryptoKey>;
  encrypt(key: CryptoKey, plaintext: string): Promise<{ iv: string; ct: string }>;
  decrypt(key: CryptoKey, envelope: { iv: string; ct: string }): Promise<string>;
  safetyNumber(myPublic: string, theirPublic: string): Promise<string>;
  hashPin(pin: string): Promise<{ hash: string; salt: string }>;
  verifyPin(pin: string, hash: string, salt: string): Promise<boolean>;
  registerPasskey(label: string): Promise<{ id: string; type: string }>;
}

export interface StorageService {
  upload(bucket: string, path: string, data: Blob, options?: { contentType?: string; upsert?: boolean }): Promise<string>;
  download(bucket: string, path: string): Promise<Blob>;
  getPublicUrl(bucket: string, path: string): string;
  remove(bucket: string, paths: string[]): Promise<void>;
}

export interface NotificationService {
  requestPermission(): Promise<boolean>;
  send(title: string, body: string, href?: string): Promise<void>;
  isPermissionGranted(): boolean;
}

export interface SimilarityEngine {
  init(): Promise<{ available: boolean; backend: string }>;
  similarity(corpus: Float32Array, query: Float32Array, count: number, dim: number): Promise<Float32Array>;
  benchmark(count?: number, dim?: number): Promise<{ gpuMs: number; cpuMs: number; speedup: number }>;
}

export interface PersistenceService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  onSync(callback: (snapshot: Record<string, unknown>) => void): () => void;
}

export interface MediaPipeline {
  processImage(file: File, kind?: "PUBLIC" | "PRIVATE"): Promise<{ url: string; thumbUrl: string; blurUrl: string; width: number; height: number; explicitness: string }>;
  sniffMime(file: File): Promise<string | null>;
  buildCalendar(data: { uid: string; title: string; description: string; location: string; start: Date; durationMinutes?: number }): string;
}
