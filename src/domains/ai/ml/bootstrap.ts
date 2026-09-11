/**
 * bootstrap.ts
 * Lazy-loading bootstrap for Transformers.js ML pipelines.
 *
 * Production patterns per docs:
 *  - Singleton caching to avoid redundant model loads
 *  - Quantized models (q4) for faster loading and lower memory
 *  - WebGPU acceleration with WASM fallback
 *  - Progress callbacks for loading UX
 *  - Proper error categorization for ML operations
 *  - Graceful degradation when CDN or GPU unavailable
 */

// Pipeline type from Transformers.js — loaded via CDN at runtime, not npm
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pipeline = any;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MLErrorCode =
  | "CDN_UNAVAILABLE"
  | "LIB_MISSING"
  | "MODEL_LOAD_FAILED"
  | "INFERENCE_FAILED"
  | "TIMEOUT"
  | "UNKNOWN";

export interface MLError {
  code: MLErrorCode;
  message: string;
  cause?: unknown;
}

export interface MLPerformanceOptions {
  /** Use WebGPU when available, fall back to WASM. Default: true */
  useWebGPU?: boolean;
  /** Quantization level. Default: 'q4' for fastest loading */
  dtype?: "fp32" | "fp16" | "q8" | "q4";
  /** Timeout in ms for model loading. Default: 15000 */
  loadTimeout?: number;
  /** Progress callback during model download */
  onProgress?: (progress: { status: string; progress?: number }) => void;
}

// ---------------------------------------------------------------------------
// Library loading
// ---------------------------------------------------------------------------

let libPromise: Promise<any> | null = null;

const LIB_URLS = [
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.1/dist/transformers.min.js",
  "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js",
];

function scriptLoad(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => {
      const tf = (window as any).transformers;
      if (tf) resolve(tf);
      else reject({ code: "LIB_MISSING" as MLErrorCode, message: "transformers global not found after script load" });
    };
    s.onerror = () => reject({ code: "CDN_UNAVAILABLE" as MLErrorCode, message: `CDN unreachable: ${url}` });
    document.head.appendChild(s);
  });
}

async function loadLibrary(): Promise<any> {
  if (libPromise) return libPromise;
  libPromise = (async () => {
    for (const url of LIB_URLS) {
      try {
        return await scriptLoad(url);
      } catch {
        // Try next CDN
      }
    }
    throw {
      code: "CDN_UNAVAILABLE" as MLErrorCode,
      message: "All Transformers.js CDN attempts failed",
    };
  })();
  return libPromise;
}

// ---------------------------------------------------------------------------
// Device detection
// ---------------------------------------------------------------------------

async function detectDevice(): Promise<"webgpu" | "wasm"> {
  try {
    if (navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return "webgpu";
    }
  } catch {
    // WebGPU unavailable or blocked
  }
  return "wasm";
}

// ---------------------------------------------------------------------------
// Classifier (zero-shot classification)
// ---------------------------------------------------------------------------

let classifier: Pipeline | null = null;

export async function loadClassifier(
  options: MLPerformanceOptions = {},
): Promise<Pipeline> {
  if (classifier) return classifier;

  const {
    useWebGPU = true,
    dtype = "q4",
    loadTimeout = 15_000,
    onProgress,
  } = options;

  const tf = await loadLibrary();
  const device = useWebGPU ? await detectDevice() : "wasm";

  const loadPromise = tf.pipeline(
    "zero-shot-classification",
    "Xenova/mobilebert-uncased-mnli",
    {
      dtype,
      device,
      quantized: true,
      progress_callback: onProgress,
    },
  );

  try {
    classifier = await Promise.race([
      loadPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject({ code: "TIMEOUT" as MLErrorCode, message: `Classifier load timed out after ${loadTimeout}ms` }),
          loadTimeout,
        ),
      ),
    ]);
  } catch (err) {
    // If WebGPU failed, retry with WASM
    if (device === "webgpu") {
      try {
        classifier = await tf.pipeline(
          "zero-shot-classification",
          "Xenova/mobilebert-uncased-mnli",
          { dtype, device: "wasm", quantized: true },
        );
      } catch (fallbackErr) {
        throw {
          code: "MODEL_LOAD_FAILED" as MLErrorCode,
          message: "Classifier failed on both WebGPU and WASM",
          cause: fallbackErr,
        };
      }
    } else {
      throw {
        code: (err as MLError).code ?? "MODEL_LOAD_FAILED",
        message: (err as MLError).message ?? "Classifier load failed",
        cause: err,
      };
    }
  }

  return classifier;
}

// ---------------------------------------------------------------------------
// Generator (text2text-generation)
// ---------------------------------------------------------------------------

let generator: Pipeline | null = null;

export async function loadGenerator(
  options: MLPerformanceOptions = {},
): Promise<Pipeline> {
  if (generator) return generator;

  const {
    useWebGPU = true,
    dtype = "q4",
    loadTimeout = 15_000,
    onProgress,
  } = options;

  const tf = await loadLibrary();
  const device = useWebGPU ? await detectDevice() : "wasm";

  const loadPromise = tf.pipeline(
    "text2text-generation",
    "Xenova/LaMini-Flan-T5-248M",
    {
      dtype,
      device,
      quantized: true,
      progress_callback: onProgress,
    },
  );

  try {
    generator = await Promise.race([
      loadPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject({ code: "TIMEOUT" as MLErrorCode, message: `Generator load timed out after ${loadTimeout}ms` }),
          loadTimeout,
        ),
      ),
    ]);
  } catch (err) {
    if (device === "webgpu") {
      try {
        generator = await tf.pipeline(
          "text2text-generation",
          "Xenova/LaMini-Flan-T5-248M",
          { dtype, device: "wasm", quantized: true },
        );
      } catch (fallbackErr) {
        throw {
          code: "MODEL_LOAD_FAILED" as MLErrorCode,
          message: "Generator failed on both WebGPU and WASM",
          cause: fallbackErr,
        };
      }
    } else {
      throw {
        code: (err as MLError).code ?? "MODEL_LOAD_FAILED",
        message: (err as MLError).message ?? "Generator load failed",
        cause: err,
      };
    }
  }

  return generator;
}

// ---------------------------------------------------------------------------
// Feature Extractor (embeddings)
// ---------------------------------------------------------------------------

let extractor: Pipeline | null = null;

export async function loadExtractor(
  options: MLPerformanceOptions = {},
): Promise<Pipeline> {
  if (extractor) return extractor;

  const {
    useWebGPU = true,
    dtype = "q4",
    loadTimeout = 20_000,
    onProgress,
  } = options;

  const tf = await loadLibrary();
  const device = useWebGPU ? await detectDevice() : "wasm";

  const loadPromise = tf.pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
    {
      dtype,
      device,
      quantized: true,
      progress_callback: onProgress,
    },
  );

  try {
    extractor = await Promise.race([
      loadPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject({ code: "TIMEOUT" as MLErrorCode, message: `Extractor load timed out after ${loadTimeout}ms` }),
          loadTimeout,
        ),
      ),
    ]);
  } catch (err) {
    if (device === "webgpu") {
      try {
        extractor = await tf.pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2",
          { dtype, device: "wasm", quantized: true },
        );
      } catch (fallbackErr) {
        throw {
          code: "MODEL_LOAD_FAILED" as MLErrorCode,
          message: "Extractor failed on both WebGPU and WASM",
          cause: fallbackErr,
        };
      }
    } else {
      throw {
        code: (err as MLError).code ?? "MODEL_LOAD_FAILED",
        message: (err as MLError).message ?? "Extractor load failed",
        cause: err,
      };
    }
  }

  return extractor;
}

// ---------------------------------------------------------------------------
// NSFW Detector (image-classification via Transformers.js)
// ---------------------------------------------------------------------------

let nsfwClassifier: Pipeline | null = null;

export async function loadNsfwDetector(
  options: MLPerformanceOptions = {},
): Promise<Pipeline> {
  if (nsfwClassifier) return nsfwClassifier;

  const {
    useWebGPU = true,
    dtype = "q4",
    loadTimeout = 20_000,
    onProgress,
  } = options;

  const tf = await loadLibrary();
  const device = useWebGPU ? await detectDevice() : "wasm";

  const loadPromise = tf.pipeline(
    "image-classification",
    "Xenova/mobilenet_v2_1.0_224",
    {
      dtype,
      device,
      quantized: true,
      progress_callback: onProgress,
    },
  );

  try {
    nsfwClassifier = await Promise.race([
      loadPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject({ code: "TIMEOUT" as MLErrorCode, message: `NSFW detector load timed out after ${loadTimeout}ms` }),
          loadTimeout,
        ),
      ),
    ]);
  } catch (err) {
    if (device === "webgpu") {
      try {
        nsfwClassifier = await tf.pipeline(
          "image-classification",
          "Xenova/mobilenet_v2_1.0_224",
          { dtype, device: "wasm", quantized: true },
        );
      } catch (fallbackErr) {
        throw {
          code: "MODEL_LOAD_FAILED" as MLErrorCode,
          message: "NSFW detector failed on both WebGPU and WASM",
          cause: fallbackErr,
        };
      }
    } else {
      throw {
        code: (err as MLError).code ?? "MODEL_LOAD_FAILED",
        message: (err as MLError).message ?? "NSFW detector load failed",
        cause: err,
      };
    }
  }

  return nsfwClassifier;
}

// ---------------------------------------------------------------------------
// Toxicity Detector (text-classification via Transformers.js)
// ---------------------------------------------------------------------------

let toxicityClassifier: Pipeline | null = null;

export async function loadToxicityDetector(
  options: MLPerformanceOptions = {},
): Promise<Pipeline> {
  if (toxicityClassifier) return toxicityClassifier;

  const {
    useWebGPU = true,
    dtype = "q4",
    loadTimeout = 20_000,
    onProgress,
  } = options;

  const tf = await loadLibrary();
  const device = useWebGPU ? await detectDevice() : "wasm";

  const loadPromise = tf.pipeline(
    "text-classification",
    "Xenova/toxic-bert",
    {
      dtype,
      device,
      quantized: true,
      progress_callback: onProgress,
    },
  );

  try {
    toxicityClassifier = await Promise.race([
      loadPromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject({ code: "TIMEOUT" as MLErrorCode, message: `Toxicity detector load timed out after ${loadTimeout}ms` }),
          loadTimeout,
        ),
      ),
    ]);
  } catch (err) {
    if (device === "webgpu") {
      try {
        toxicityClassifier = await tf.pipeline(
          "text-classification",
          "Xenova/toxic-bert",
          { dtype, device: "wasm", quantized: true },
        );
      } catch (fallbackErr) {
        throw {
          code: "MODEL_LOAD_FAILED" as MLErrorCode,
          message: "Toxicity detector failed on both WebGPU and WASM",
          cause: fallbackErr,
        };
      }
    } else {
      throw {
        code: (err as MLError).code ?? "MODEL_LOAD_FAILED",
        message: (err as MLError).message ?? "Toxicity detector load failed",
        cause: err,
      };
    }
  }

  return toxicityClassifier;
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

export function resetMLState(): void {
  classifier = null;
  generator = null;
  extractor = null;
  nsfwClassifier = null;
  toxicityClassifier = null;
  libPromise = null;
}
