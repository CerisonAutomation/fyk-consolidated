/**
 * Browser PersistenceService adapter.
 *
 * Local-first persistence backed by IndexedDB for structured state and
 * BroadcastChannel so several tabs of FYK stay in step.
 *
 * Everything is scoped to this origin and never leaves the device.
 * The hosted build mirrors the same shape to SQLite; the interfaces
 * are deliberately identical so the service layer does not care which
 * is underneath.
 *
 * Implements the PersistenceService port from core/ports/services.ts.
 */

import type { PersistenceService } from "../../core/ports/services";

// ─── IndexedDB helpers ───────────────────────────────────────────────────────

const DB_NAME = "fyk";
const DB_VERSION = 1;
const STORE_NAME = "kv" as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(STORE_NAME, "readonly");
      const req = t.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE_NAME, "readwrite");
      const req = t.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silent failure -- offline-first, best effort
  }
}

async function idbDel(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE_NAME, "readwrite");
      const req = t.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silent failure
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE_NAME, "readwrite");
      const req = t.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silent failure
  }
}

// ─── BroadcastChannel ────────────────────────────────────────────────────────

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("fyk-sync")
    : null;

// ─── Service implementation ──────────────────────────────────────────────────

export const browserPersistAdapter: PersistenceService = {
  async get<T>(key: string): Promise<T | null> {
    const v = await idbGet<T>(key);
    return v ?? null;
  },

  async set(key: string, value: unknown): Promise<void> {
    await idbSet(key, value);
    // Broadcast to other tabs
    channel?.postMessage({ type: "sync", key, value });
  },

  async del(key: string): Promise<void> {
    await idbDel(key);
    channel?.postMessage({ type: "sync", key, value: null });
  },

  async clear(): Promise<void> {
    await idbClear();
    channel?.postMessage({ type: "clear" });
  },

  /**
   * Listen for cross-tab state changes via BroadcastChannel.
   * Returns an unsubscribe function.
   */
  onSync(
    callback: (snapshot: Record<string, unknown>) => void,
  ): () => void {
    if (!channel) return () => {};

    const handler = (e: MessageEvent) => {
      if (e.data?.type === "sync" && e.data.key) {
        callback({ [e.data.key]: e.data.value });
      }
      if (e.data?.type === "clear") {
        callback({ __clear: true } as Record<string, unknown>);
      }
    };

    channel.addEventListener("message", handler);
    return () => channel.removeEventListener("message", handler);
  },
};
