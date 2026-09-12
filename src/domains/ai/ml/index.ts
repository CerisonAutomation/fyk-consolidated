/**
 * ML domain barrel export.
 *
 * Provides access to all ML inference components:
 *  - Bootstrap: lazy-loading for Transformers.js pipelines
 *  - Classifier: zero-shot intent classification
 *  - Generator: text2text generation for replies/bios
 *  - Embedding: feature-extraction for vector search
 *  - NSFW Detect: image safety scanning
 */

export {
  loadClassifier,
  loadGenerator,
  loadExtractor,
  loadNsfwDetector,
  loadToxicityDetector,
  resetMLState,
  type MLError,
  type MLErrorCode,
  type MLPerformanceOptions,
} from "./bootstrap";

export {
  classifyIntent,
  heuristicIntent,
  type Intent,
} from "./classifier";

export {
  generateReply,
  rewriteBio,
} from "./generator";

export {
  generateEmbedding,
  generateEmbeddings,
  hashEmbedding,
  profileVector,
  queryVector,
  EMBEDDING_DIM,
  type EmbeddingResult,
} from "./embedding";

export {
  scanImage,
  type ScanResult,
  type NSFWCategory,
} from "./nsfw-detect";
