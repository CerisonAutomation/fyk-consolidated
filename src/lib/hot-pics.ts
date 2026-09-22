/**
 * Hot Pics — 2.9
 * Opt-in showcase: user sends hot pics query to profile, owner accepts/declines.
 */

export type HotPicsRequest = {
  id: string;
  requesterId: string;
  ownerId: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: string;
  resolvedAt?: string;
  expiresAt: string;
};

export function createHotPicsRequest(requesterId: string, ownerId: string): HotPicsRequest {
  return {
    id: crypto.randomUUID(),
    requesterId,
    ownerId,
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function canViewHotPics(request: HotPicsRequest | null, isOwner: boolean): boolean {
  if (isOwner) return true;
  if (!request) return false;
  if (request.status !== "accepted") return false;
  if (new Date(request.expiresAt).getTime() < Date.now()) return false;
  return true;
}

export function isHotPicsExpired(request: HotPicsRequest): boolean {
  return new Date(request.expiresAt).getTime() < Date.now();
}
