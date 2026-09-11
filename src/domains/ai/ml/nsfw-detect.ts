let nsfwPromise: Promise<any> | null = null;

export async function scanImage(dataUrl: string): Promise<{ ok: boolean; score: number; source: "model" | "unavailable" }> {
  if (!nsfwPromise) {
    nsfwPromise = (async () => {
      try {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/nsfwjs@4.2.1/dist/index.umd.min.js";
          s.async = true;
          s.onload = () => (window as any).nsfwjs ? res() : rej(new Error("missing"));
          s.onerror = () => rej(new Error("cdn"));
          document.head.appendChild(s);
        });
        return await (window as any).nsfwjs.load();
      } catch { nsfwPromise = null; return null; }
    })();
  }
  const model = await nsfwPromise;
  if (!model) return { ok: false, score: 0, source: "unavailable" };
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("img"));
      i.src = dataUrl;
    });
    const preds = await model.classify(img);
    const bad = (preds.find((p: any) => p.className === "Hentai")?.prob ?? 0) + (preds.find((p: any) => p.className === "Porn")?.prob ?? 0);
    return { ok: true, score: bad, source: "model" };
  } catch { return { ok: false, score: 0, source: "unavailable" }; }
}
