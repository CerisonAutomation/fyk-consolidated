/**
 * churn-predict.ts
 * Predicts churn risk 0-100 based on silence duration + reply ratio.
 */

export interface ChurnMessage {
  senderId: number;
  timestamp: number;
}

export interface ChurnResult {
  risk: number;
  reason: string;
  intervention: string;
}

function computeSilenceDays(messages: ChurnMessage[], lastActive: number): number {
  const now = Date.now();
  const last = lastActive > 0 ? lastActive : (messages.length > 0 ? messages[messages.length - 1]!.timestamp : now);
  return (now - last) / (1000 * 60 * 60 * 24);
}

function computeReplyRatio(messages: ChurnMessage[]): number {
  if (messages.length < 2) return 0.5;

  const theirMsgs = messages.filter((m) => m.senderId !== messages[0]!.senderId);
  const myMsgs = messages.filter((m) => m.senderId === messages[0]!.senderId);

  if (theirMsgs.length === 0) return 0;
  if (myMsgs.length === 0) return 1;

  let replyCount = 0;
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1]!;
    const curr = messages[i]!;
    if (prev.senderId !== curr.senderId) {
      replyCount++;
    }
  }

  const maxPossible = Math.min(theirMsgs.length, myMsgs.length);
  return maxPossible > 0 ? replyCount / maxPossible : 0;
}

function computeConversationMomentum(messages: ChurnMessage[]): number {
  if (messages.length < 4) return 0.5;

  const midpoint = Math.floor(messages.length / 2);
  const firstHalf = messages.slice(0, midpoint);
  const secondHalf = messages.slice(midpoint);

  const firstRate = firstHalf.length > 0
    ? (firstHalf[firstHalf.length - 1]!.timestamp - firstHalf[0]!.timestamp) / firstHalf.length
    : 0;
  const secondRate = secondHalf.length > 0
    ? (secondHalf[secondHalf.length - 1]!.timestamp - secondHalf[0]!.timestamp) / secondHalf.length
    : 0;

  if (secondRate === 0) return 1;
  if (firstRate === 0) return 0.5;
  return firstRate / secondRate;
}

export function predictChurn(
  messages: ChurnMessage[],
  lastActive: number,
): ChurnResult {
  const silenceDays = computeSilenceDays(messages, lastActive);
  const replyRatio = messages.length > 0 ? computeReplyRatio(messages) : 0;
  const momentum = computeConversationMomentum(messages);

  let risk = 0;

  if (silenceDays <= 1) risk += 10;
  else if (silenceDays <= 2) risk += 25;
  else if (silenceDays <= 3) risk += 45;
  else if (silenceDays <= 7) risk += 65;
  else risk += 85;

  if (replyRatio < 0.2) risk += 25;
  else if (replyRatio < 0.4) risk += 15;
  else if (replyRatio < 0.6) risk += 5;

  if (momentum < 0.5) risk += 15;
  else if (momentum > 2) risk -= 10;

  risk = Math.max(0, Math.min(100, risk));

  let reason: string;
  let intervention: string;

  if (silenceDays > 5) {
    reason = "Extended silence suggests lost interest";
    intervention = "Send a low-pressure check-in message";
  } else if (replyRatio < 0.3) {
    reason = "Low reply ratio indicates one-sided conversation";
    intervention = "Ask an open-ended question about their interests";
  } else if (silenceDays > 2) {
    reason = "Growing gap between messages";
    intervention = "Reference something specific from earlier conversation";
  } else if (momentum < 0.5) {
    reason = "Conversation pace is slowing down";
    intervention = "Try a different topic or share something interesting";
  } else {
    reason = "Conversation seems stable";
    intervention = "Keep the momentum going with engaging messages";
  }

  return { risk, reason, intervention };
}
