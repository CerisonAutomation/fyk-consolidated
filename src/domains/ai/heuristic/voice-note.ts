/**
 * AI Voice-Note Reply — 25.17
 * User picks suggested reply and taps "read it to them" — model generates warm voice note in user's tone.
 */

export type VoiceNote = {
  id: string;
  text: string;
  audioUrl?: string;
  durationSec: number;
  transcript: string;
  tone: "warm" | "casual" | "flirty" | "friendly";
  createdAt: string;
};

export function generateVoiceNote(text: string, tone: VoiceNote["tone"] = "warm"): VoiceNote {
  // Production: TTS with voice cloning (ElevenLabs, etc.)
  // Here: simulate with duration estimate and transcript

  const words = text.split(/\s+/).length;
  const durationSec = Math.max(1, Math.round((words / 150) * 60)); // 150 wpm

  return {
    id: crypto.randomUUID(),
    text,
    audioUrl: undefined, // would be blob URL from TTS
    durationSec,
    transcript: text,
    tone,
    createdAt: new Date().toISOString(),
  };
}

export function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round((words / 150) * 60));
}

export const VOICE_TONES: VoiceNote["tone"][] = ["warm", "casual", "flirty", "friendly"];
