/**
 * @deprecated Use src/lib/routing instead. Kept for compatibility.
 */
export * from "./routing/deduplication";
export * from "./routing/api-factory";
export { getRoutingOptimization } from "./routing";
import { getDeduplicationStats } from "./routing/deduplication";
import { optimizeBundles } from "./routing/bundle-optimizer";

export class UnifiedApiClient {
  private baseUrl: string;
  private userId: string | null = null;
  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }
  setUserId(userId: string) {
    this.userId = userId;
  }
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(this.userId ? { "x-user-id": this.userId } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      throw new Error(err.error ?? res.statusText);
    }
    return res.json() as Promise<T>;
  }
  async list<T>(path: string, params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    return this.request<{ data: T[]; total: number }>(`${path}${query}`);
  }
  async get<T>(path: string, id: string) {
    return this.request<{ data: T }>(`${path}/${id}`);
  }
  async create<T>(path: string, data: unknown) {
    return this.request<{ data: T }>(path, { method: "POST", body: JSON.stringify(data) });
  }
  async update<T>(path: string, id: string, data: unknown) {
    return this.request<{ data: T }>(`${path}/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }
  async delete(path: string, id: string) {
    return this.request<{ success: boolean }>(`${path}/${id}`, { method: "DELETE" });
  }
  async batch<T>(requests: Array<{ path: string; method?: string; body?: unknown }>): Promise<T[]> {
    return Promise.all(
      requests.map((r) => this.request<T>(r.path, { method: r.method ?? "GET", body: r.body ? JSON.stringify(r.body) : undefined })),
    );
  }
}
export const apiClient = new UnifiedApiClient();
export function optimizeAllRoutes() {
  const stats = getDeduplicationStats();
  const bundle = optimizeBundles(768);
  return {
    deduplication: stats,
    bundle,
    recommendations: [
      `Deduplicate ${stats.totalOriginal} → ${stats.totalCanonical} canonical — saves ${stats.codeLinesSaved} lines, ${stats.bundleKbSaved}KB`,
      `Bundle: ${bundle.strategy}`,
    ],
    overallSavings: { lines: stats.codeLinesSaved, kb: stats.bundleKbSaved + bundle.savingsKb, duplicationScore: stats.duplicationScore },
  };
}
export const deduplicatedRoutes = [
  { group: "profile", routes: [{ path: "/api/profile" }], canonical: "/api/profile", factory: () => ({}) },
] as const;
export const sharedMiddleware = {
  requireAuth: async (userId: string | null) => {
    if (!userId) throw new Error("Unauthorized");
    return userId;
  },
  rateLimit: { read: { max: 200, window: 60 }, write: { max: 100, window: 60 }, sensitive: { max: 20, window: 60 }, auth: { max: 10, window: 60 } },
  pagination: { limit: 20 },
  auditLog: () => {},
  idempotency: async (_k: string, fn: () => Promise<unknown>) => fn(),
};
