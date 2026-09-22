/**
 * Safety Center — Production safety features (21.x)
 * Two-factor auth, emergency share, check-in, report transcript, etc.
 */

export type EmergencyContact = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
  createdAt: string;
};

export type SafetyCheckIn = {
  id: string;
  userId: string;
  contactId: string;
  location: { lat: number; lng: number; address?: string } | null;
  meetingWith: string | null; // profileId
  scheduledAt: string;
  expiresAt: string;
  status: "active" | "safe" | "overdue" | "resolved";
  safeWord?: string;
};

export type ReportWithTranscript = {
  id: string;
  reporterId: string;
  targetId: string;
  targetType: "profile" | "message" | "photo" | "event";
  reason: string;
  details?: string;
  transcript?: { senderId: string; text: string; timestamp: string }[];
  screenshots?: string[];
  status: "open" | "in_review" | "action_taken" | "dismissed";
  createdAt: string;
};

export type SafetySettings = {
  shareLocationWithContacts: boolean;
  autoCheckInEnabled: boolean;
  checkInIntervalMinutes: number;
  emergencySosEnabled: boolean;
  blurExplicitContent: boolean;
  hideFromSearchWhenSafetyMode: boolean;
};

export const DEFAULT_SAFETY_SETTINGS: SafetySettings = {
  shareLocationWithContacts: false,
  autoCheckInEnabled: false,
  checkInIntervalMinutes: 60,
  emergencySosEnabled: true,
  blurExplicitContent: true,
  hideFromSearchWhenSafetyMode: false,
};

export function validateEmergencyContact(contact: Partial<EmergencyContact>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!contact.name || contact.name.trim().length < 2) errors.push("Name required (2+ chars)");
  if (!contact.phone || !/^\+?[0-9\s\-()]{7,20}$/.test(contact.phone)) errors.push("Valid phone required");
  if (!contact.relationship) errors.push("Relationship required");
  return { valid: errors.length === 0, errors };
}

export function shouldTriggerOverdue(checkIn: SafetyCheckIn): boolean {
  return new Date(checkIn.expiresAt).getTime() < Date.now() && checkIn.status === "active";
}

export function generateSafeWord(): string {
  const words = ["apple", "river", "mountain", "ocean", "forest", "sunset", "bridge", "garden"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function formatEmergencyMessage(params: {
  userName: string;
  location?: { lat: number; lng: number; address?: string };
  meetingWith?: string;
  checkInId: string;
}): string {
  const loc = params.location ? `${params.location.address || `${params.location.lat},${params.location.lng}`}` : "Unknown location";
  return `🚨 Safety Alert from ${params.userName}\n` +
    `Location: ${loc}\n` +
    (params.meetingWith ? `Meeting with: ${params.meetingWith}\n` : "") +
    `Check-in ID: ${params.checkInId}\n` +
    `Please check on them if you don't hear back soon.`;
}

export type DataExportRequest = {
  id: string;
  userId: string;
  requestedAt: string;
  completedAt?: string;
  downloadUrl?: string;
  expiresAt?: string;
  includes: ("profile" | "messages" | "photos" | "settings" | "activity")[];
  status: "pending" | "processing" | "ready" | "expired";
};

export function createDataExportRequest(userId: string, includes: DataExportRequest["includes"]): Omit<DataExportRequest, "id" | "requestedAt" | "status"> & { requestedAt: string; status: DataExportRequest["status"] } {
  return {
    userId,
    requestedAt: new Date().toISOString(),
    status: "pending",
    includes,
  };
}
