/**
 * Client-side media pipeline.
 * Magic-byte sniff → canvas re-encode (drops EXIF/GPS by construction) → WebP → thumbnail
 * → blur placeholder → a basic local visual heuristic. This is not a
 * moderation-grade NSFW classifier and does not approve content.
 */

export type ProcessedPhoto = {
  id: string;
  url: string;
  thumbUrl: string;
  blurUrl: string;
  averageColor: string;
  width: number;
  height: number;
  bytes: number;
  originalBytes: number;
  mime: string;
  kind: "PUBLIC" | "PRIVATE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  explicitness: "CLEAN" | "MATURE" | "EXPLICIT";
  primary: boolean;
  createdAt: number;
  name: string;
};

const MAX_EDGE = 1600;
const THUMB_EDGE = 320;

const MAGIC: { mime: string; bytes: number[] }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
];

export async function sniffMime(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  for (const sig of MAGIC) {
    if (sig.bytes.every((b, i) => head[i] === b)) return sig.mime;
  }
  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = src;
  });
}

function draw(img: HTMLImageElement, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx, w, h };
}

function toDataUrl(canvas: HTMLCanvasElement, quality = 0.86) {
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
}

/** Very rough warm-tone ratio. It only adds a local warning label. */
function skinRatio(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const { data } = ctx.getImageData(0, 0, w, h);
  let skin = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 4 * 17) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    total++;
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - Math.min(g, b) > 15) skin++;
  }
  return total ? skin / total : 0;
}

function averageColor(ctx: CanvasRenderingContext2D, w: number, h: number): string {
  const { data } = ctx.getImageData(0, 0, w, h);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4 * 29) {
    r += data[i] ?? 0;
    g += data[i + 1] ?? 0;
    b += data[i + 2] ?? 0;
    n++;
  }
  if (!n) return "#1b1f26";
  return `rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})`;
}

export async function processPhoto(
  file: File,
  kind: "PUBLIC" | "PRIVATE" = "PUBLIC",
): Promise<ProcessedPhoto> {
  const mime = await sniffMime(file);
  if (!mime) throw new Error("That file isn't a supported image (JPEG, PNG, GIF or WebP).");
  if (file.size > 25 * 1024 * 1024) throw new Error("Images need to be under 25 MB.");

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const full = draw(img, MAX_EDGE);
    const url = toDataUrl(full.canvas);

    const thumb = draw(img, THUMB_EDGE);
    const thumbUrl = toDataUrl(thumb.canvas, 0.7);

    const tiny = draw(img, 28);
    tiny.ctx.filter = "blur(6px)";
    tiny.ctx.drawImage(tiny.canvas, 0, 0);
    const blurUrl = toDataUrl(tiny.canvas, 0.5);

    const ratio = skinRatio(thumb.ctx, thumb.w, thumb.h);
    const explicitness: ProcessedPhoto["explicitness"] =
      ratio > 0.46 ? "EXPLICIT" : ratio > 0.3 ? "MATURE" : "CLEAN";

    return {
      id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url,
      thumbUrl,
      blurUrl,
      averageColor: averageColor(tiny.ctx, tiny.w, tiny.h),
      width: full.w,
      height: full.h,
      bytes: Math.round((url.length * 3) / 4),
      originalBytes: file.size,
      mime: "image/webp",
      kind,
      // Status is local pipeline state, not a moderation decision.
      status: explicitness === "CLEAN" ? "APPROVED" : "PENDING",
      explicitness,
      primary: false,
      createdAt: Date.now(),
      name: file.name.replace(/\.[^.]+$/, ""),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function dataUrlToBlob(url: string): Blob {
  const [header, payload] = url.split(",", 2);
  if (!header || !payload) throw new Error("The processed image could not be encoded.");
  const mime = header.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ------------------------------ downloads ------------------------------ */

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(d: Date) {
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** RFC 5545 file, generated entirely on-device. */
export function buildIcs(input: {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  durationMinutes?: number;
}): string {
  const end = new Date(input.start.getTime() + (input.durationMinutes ?? 120) * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FYK//Find Your King//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.uid}@fyk.local`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(input.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(input.title)}`,
    `DESCRIPTION:${icsEscape(input.description)}`,
    `LOCATION:${icsEscape(input.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function vcard(name: string, note: string): string {
  return ["BEGIN:VCARD", "VERSION:3.0", `FN:${name}`, `NOTE:${note}`, "END:VCARD"].join("\r\n");
}
