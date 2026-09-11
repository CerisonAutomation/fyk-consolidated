/**
 * Local-first persistence.
 *   • IndexedDB for structured state (settings, signals, threads, plans)
 *   • Origin Private File System for binary blobs (voice notes, processed photos)
 *   • BroadcastChannel so several tabs of FYK stay in step
 *
 * Everything is scoped to this origin and never leaves the device. The hosted
 * build mirrors the same shape to SQLite; the interfaces are deliberately
 * identical so the service layer doesn't care which is underneath.
 */

const DB_NAME = "fyk";
const DB_VERSION = 1;
const STORES = ["kv", "threads", "media"] as const;
type StoreName = (typeof STORES)[number];

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
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

async function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export const idb = {
  get: <T>(store: StoreName, key: string) => tx<T>(store, "readonly", (s) => s.get(key)),
  set: (store: StoreName, key: string, value: unknown) => tx(store, "readwrite", (s) => s.put(value, key)),
  del: (store: StoreName, key: string) => tx(store, "readwrite", (s) => s.delete(key)),
  keys: (store: StoreName) => tx<IDBValidKey[]>(store, "readonly", (s) => s.getAllKeys()),
  clear: (store: StoreName) => tx(store, "readwrite", (s) => s.clear()),
};

/* ------------------------------- state sync ----------------------------- */

const SNAPSHOT_KEY = "state:v1";

export type Snapshot = Record<string, unknown>;

let saveTimer = 0;

/** Debounced so a burst of interactions writes once. */
export function persistState(snapshot: Snapshot) {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void idb.set("kv", SNAPSHOT_KEY, { ...snapshot, savedAt: Date.now() });
    channel?.postMessage({ type: "state", snapshot });
  }, 400);
}

export async function loadState(): Promise<Snapshot | null> {
  const v = await idb.get<Snapshot>("kv", SNAPSHOT_KEY);
  return v ?? null;
}

export async function clearAllData(): Promise<void> {
  for (const s of STORES) await idb.clear(s);
  try {
    const root = await navigator.storage?.getDirectory?.();
    if (root) {
      for await (const [name] of (root as unknown as { entries: () => AsyncIterable<[string, unknown]> }).entries()) {
        await root.removeEntry(name, { recursive: true }).catch(() => {});
      }
    }
  } catch {
    /* OPFS unavailable */
  }
}

/* ------------------------------ broadcast ------------------------------- */

export const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("fyk-sync") : null;

export function onRemoteState(fn: (snapshot: Snapshot) => void): () => void {
  if (!channel) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === "state" && e.data.snapshot) fn(e.data.snapshot as Snapshot);
  };
  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}

/* --------------------------------- OPFS --------------------------------- */

async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await navigator.storage?.getDirectory?.()) ?? null;
  } catch {
    return null;
  }
}

export const opfs = {
  async write(name: string, data: Blob | ArrayBuffer): Promise<boolean> {
    const root = await opfsRoot();
    if (!root) return false;
    try {
      const handle = await root.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  },

  async read(name: string): Promise<Blob | null> {
    const root = await opfsRoot();
    if (!root) return null;
    try {
      const handle = await root.getFileHandle(name);
      return await handle.getFile();
    } catch {
      return null;
    }
  },

  async remove(name: string): Promise<boolean> {
    const root = await opfsRoot();
    if (!root) return false;
    try {
      await root.removeEntry(name);
      return true;
    } catch {
      return false;
    }
  },

  async list(): Promise<string[]> {
    const root = await opfsRoot();
    if (!root) return [];
    const out: string[] = [];
    try {
      for await (const [name] of (root as unknown as { entries: () => AsyncIterable<[string, unknown]> }).entries()) {
        out.push(name);
      }
    } catch {
      /* unsupported iterator */
    }
    return out;
  },
};

/* ----------------------------- service worker --------------------------- */

export type SwStatus = "unsupported" | "registering" | "active" | "unavailable";

export async function registerServiceWorker(): Promise<SwStatus> {
  if (!("serviceWorker" in navigator)) return "unsupported";
  // A single-file build has no separate script to register; say so rather than pretend.
  if (location.protocol === "file:") return "unavailable";
  try {
    const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
    return reg.active ? "active" : "registering";
  } catch {
    return "unavailable";
  }
}

/* ------------------------------ install prompt -------------------------- */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferredInstall: InstallEvent | null = null;

export function watchInstallPrompt(onAvailable: (available: boolean) => void) {
  const handler = (e: Event) => {
    e.preventDefault();
    deferredInstall = e as InstallEvent;
    onAvailable(true);
  };
  window.addEventListener("beforeinstallprompt", handler);
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    onAvailable(false);
  });
  return () => window.removeEventListener("beforeinstallprompt", handler);
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredInstall) return "unavailable";
  await deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  deferredInstall = null;
  return outcome === "accepted" ? "accepted" : "dismissed";
}

export const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
