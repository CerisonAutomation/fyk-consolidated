/**
 * Scheduled / Send-Later Messages — 27.5
 * Composer supports send-at time, stored server-side as scheduled, delivered at set time.
 */

export type ScheduledMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  type: string;
  scheduledAt: string;
  status: "scheduled" | "sent" | "cancelled" | "failed";
  createdAt: string;
  sentAt?: string;
};

export function createScheduledMessage(params: {
  conversationId: string;
  senderId: string;
  body: string;
  type?: string;
  scheduledAt: string;
}): ScheduledMessage {
  return {
    id: crypto.randomUUID(),
    conversationId: params.conversationId,
    senderId: params.senderId,
    body: params.body.slice(0, 4000),
    type: params.type ?? "text",
    scheduledAt: params.scheduledAt,
    status: "scheduled",
    createdAt: new Date().toISOString(),
  };
}

export function isScheduledDue(message: ScheduledMessage): boolean {
  if (message.status !== "scheduled") return false;
  return new Date(message.scheduledAt).getTime() <= Date.now();
}

export function validateScheduledTime(scheduledAt: string): { valid: boolean; error?: string } {
  const date = new Date(scheduledAt);
  if (isNaN(date.getTime())) return { valid: false, error: "Invalid date" };
  if (date.getTime() <= Date.now()) return { valid: false, error: "Must be in future" };
  const maxFuture = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  if (date.getTime() > maxFuture) return { valid: false, error: "Max 30 days in future" };
  return { valid: true };
}

export function getScheduledMessagesDue(messages: ScheduledMessage[]): ScheduledMessage[] {
  return messages.filter(isScheduledDue);
}
