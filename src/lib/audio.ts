/**
 * Voice-message capture and waveform rendering.
 * MediaRecorder → Blob → object URL, with live amplitude sampling from an AnalyserNode
 * so the waveform is the real signal rather than a decorative animation.
 */

export type VoiceClip = {
  id: string;
  url: string;
  seconds: number;
  peaks: number[];
  mime: string;
};

const BARS = 40;

function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private startedAt = 0;

  peaks: number[] = [];
  level = 0;
  seconds = 0;

  onTick: ((s: { seconds: number; level: number; peaks: number[] }) => void) | null = null;

  get supported() {
    return typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  }

  async start(): Promise<boolean> {
    if (!this.supported) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      return false;
    }

    const mime = pickMime();
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.peaks = [];
    this.seconds = 0;
    this.recorder.ondataavailable = (e) => e.data.size > 0 && this.chunks.push(e.data);
    this.recorder.start(120);
    this.startedAt = Date.now();

    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser);

    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    let lastSample = 0;

    const loop = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = ((buf[i] ?? 128) - 128) / 128;
        sum += v * v;
      }
      this.level = Math.min(1, Math.sqrt(sum / buf.length) * 3.4);
      const now = Date.now();
      this.seconds = (now - this.startedAt) / 1000;
      // One bar roughly every 150 ms keeps the waveform readable at any length.
      if (now - lastSample > 150) {
        lastSample = now;
        this.peaks.push(Math.max(0.06, this.level));
        if (this.peaks.length > 240) this.peaks.shift();
      }
      this.onTick?.({ seconds: this.seconds, level: this.level, peaks: this.peaks });
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    return true;
  }

  async stop(): Promise<VoiceClip | null> {
    const rec = this.recorder;
    if (!rec) return null;
    cancelAnimationFrame(this.raf);

    const blob: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType || "audio/webm" }));
      rec.stop();
    });

    const seconds = Math.max(0.4, (Date.now() - this.startedAt) / 1000);
    const peaks = resample(this.peaks, BARS);

    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.recorder = null;
    this.ctx = null;
    this.analyser = null;

    return {
      id: `voice-${Date.now()}`,
      url: URL.createObjectURL(blob),
      seconds: Math.round(seconds * 10) / 10,
      peaks,
      mime: blob.type,
    };
  }

  cancel() {
    cancelAnimationFrame(this.raf);
    try {
      this.recorder?.stop();
    } catch {
      /* already stopped */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.recorder = null;
    this.ctx = null;
  }
}

/** Squash or stretch an arbitrary sample list into a fixed bar count. */
export function resample(values: number[], bars: number): number[] {
  if (values.length === 0) return new Array(bars).fill(0.15);
  const out: number[] = [];
  const step = values.length / bars;
  for (let i = 0; i < bars; i++) {
    const from = Math.floor(i * step);
    const to = Math.max(from + 1, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = from; j < to && j < values.length; j++) peak = Math.max(peak, values[j] ?? 0);
    out.push(Math.min(1, Math.max(0.08, peak)));
  }
  return out;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Deterministic fake waveform for seeded demo clips, so they look plausible. */
export function seededPeaks(seed: string, bars = BARS): number[] {
  let h = 2166136261;
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 16777619);
    out.push(0.18 + ((h >>> 0) % 1000) / 1000 * 0.82);
  }
  return out;
}
