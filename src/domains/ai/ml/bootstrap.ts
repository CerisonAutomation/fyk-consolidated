let libPromise: Promise<any> | null = null;
let classifier: any = null;
let generator: any = null;

const LIB_URLS = [
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.1/dist/transformers.min.js",
  "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js",
];

async function scriptLoad(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url; s.async = true;
    s.onload = () => (window as any).transformers ? resolve((window as any).transformers) : reject(new Error("lib missing"));
    s.onerror = () => reject(new Error("cdn unavailable"));
    document.head.appendChild(s);
  });
}

export async function loadClassifier(): Promise<any> {
  if (classifier) return classifier;
  if (!libPromise) {
    libPromise = (async () => {
      for (const url of LIB_URLS) { try { return await scriptLoad(url); } catch {} }
      throw new Error("all cdn attempts failed");
    })();
  }
  const tf = await libPromise;
  classifier = await tf.pipeline("zero-shot-classification", "Xenova/mobilebert-uncased-mnli", { quantized: true });
  return classifier;
}

export async function loadGenerator(): Promise<any> {
  if (generator) return generator;
  if (!libPromise) {
    libPromise = (async () => {
      for (const url of LIB_URLS) { try { return await scriptLoad(url); } catch {} }
      throw new Error("all cdn attempts failed");
    })();
  }
  const tf = await libPromise;
  generator = await tf.pipeline("text2text-generation", "Xenova/LaMini-Flan-T5-248M", { quantized: true });
  return generator;
}

export async function loadNsfwDetector(): Promise<any> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/nsfwjs@4.2.1/dist/index.umd.min.js";
    s.async = true;
    s.onload = () => (window as any).nsfwjs ? resolve((window as any).nsfwjs) : reject(new Error("missing"));
    s.onerror = () => reject(new Error("cdn"));
    document.head.appendChild(s);
  });
}
