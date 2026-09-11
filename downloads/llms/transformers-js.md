# Transformers.js Browser Inference Patterns

> Practical implementation patterns for running ML models directly in the browser using Transformers.js.

## Overview

Transformers.js brings Hugging Face Transformers to the web, enabling client-side inference with zero server costs. Models run entirely in the browser using WebAssembly (WASM) or WebGPU acceleration.

**Package:** `@huggingface/transformers`
**Docs:** https://huggingface.co/docs/transformers.js

---

## Installation

```bash
npm install @huggingface/transformers
```

```html
<!-- Direct browser usage -->
<script type="module">
  import { pipeline } from '@huggingface/transformers';
</script>
```

---

## Core Pipeline API

The `pipeline()` factory creates task-specific inference objects:

```javascript
import { pipeline } from '@huggingface/transformers';

// Text Classification / Sentiment Analysis
const classifier = await pipeline('sentiment-analysis');
const result = await classifier('I love this product!');
// Output: [{'label': 'POSITIVE', 'score': 0.9998}]

// With a specific multilingual model
const classifier = await pipeline(
  'sentiment-analysis',
  'Xenova/bert-base-multilingual-uncased-sentiment'
);
```

---

## Available Pipeline Tasks

| Category | Tasks |
|----------|-------|
| **NLP** | `text-classification`, `token-classification`, `ner`, `question-answering`, `summarization`, `translation`, `text-generation`, `fill-mask`, `zero-shot-classification` |
| **Vision** | `image-classification`, `object-detection`, `image-segmentation`, `depth-estimation`, `image-to-text` |
| **Audio** | `automatic-speech-recognition`, `audio-classification` |
| **Multimodal** | `zero-shot-image-classification`, `zero-shot-object-detection`, `document-question-answering` |
| **Special** | `background-removal` |

Aliases: `sentiment-analysis` maps to `text-classification`, `ner` maps to `token-classification`.

---

## Practical Patterns

### 1. Feature Extraction (Embeddings)

Generate sentence embeddings for semantic search, clustering, or similarity:

```javascript
import { pipeline } from '@huggingface/transformers';

const extractor = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

// Generate embedding for a sentence
const output = await extractor('This is a test sentence', {
  pooling: 'mean',
  normalize: true,
});

const embedding = Array.from(output.data);
// Float32Array(384) of embedding values
```

### 2. Named Entity Recognition (NER)

Extract entities from text:

```javascript
const ner = await pipeline('token-classification', 'Xenova/bert-base-NER');
const entities = await ner('My name is Sarah and I live in Berlin');
// Output: [
//   { entity_group: 'PER', word: 'Sarah', score: 0.998, ... },
//   { entity_group: 'LOC', word: 'Berlin', score: 0.997, ... }
// ]
```

### 3. Zero-Shot Classification

Classify text into arbitrary categories without training:

```javascript
const classifier = await pipeline('zero-shot-classification');
const result = await classifier(
  'The movie was absolutely fantastic and beautifully acted',
  ['entertainment', 'sports', 'politics', 'technology'],
  { multi_label: false }
);
// Output: { labels: ['entertainment', ...], scores: [0.95, ...] }
```

### 4. Image Classification

```javascript
const classifier = await pipeline('image-classification');
const result = await classifier('https://example.com/photo.jpg');
// Output: [{ label: 'cat', score: 0.98 }, { label: 'dog', score: 0.02 }]
```

### 5. Question Answering

```javascript
const qa = await pipeline('question-answering');
const result = await qa(
  'What is the capital of France?',
  'Paris is the capital of France. It is also the largest city in the country.'
);
// Output: { answer: 'Paris', score: 0.98, start: 0, end: 5 }
```

### 6. Text Generation

```javascript
const generator = await pipeline(
  'text-generation',
  'Xenova/gpt2',
  { max_new_tokens: 50 }
);
const result = await generator('The meaning of life is');
```

---

## Performance Optimization

### WebGPU Acceleration

Run models on the GPU for faster inference:

```javascript
const pipe = await pipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  { device: 'webgpu' }
);
```

### Quantization

Use quantized models for faster loading and lower memory:

```javascript
const pipe = await pipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  {
    dtype: 'q4',  // Options: 'fp32', 'fp16', 'q8', 'q4'
  }
);
```

**Quantization trade-offs:**
- `fp32` - Full precision, largest model, most accurate
- `fp16` - Half precision, good accuracy, ~50% smaller
- `q8` - 8-bit quantized, slight accuracy loss, much smaller
- `q4` - 4-bit quantized, fastest loading, some accuracy loss

### Progress Callbacks

Track model loading progress:

```javascript
const pipe = await pipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  {
    progress_callback: (progress) => {
      if (progress.status === 'progress') {
        console.log(`Loading: ${progress.progress}%`);
      }
    },
  }
);
```

### Device Selection

```javascript
const pipe = await pipeline('task', 'model', {
  device: 'wasm' | 'webgpu',  // Execution device
});
```

---

## Production Deployment Patterns

### Static Site (CDN)

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers';
  </script>
</head>
<body>
  <script type="module">
    const classifier = await pipeline('sentiment-analysis');
    const result = await classifier('Hello world');
    document.body.textContent = JSON.stringify(result);
  </script>
</body>
</html>
```

### With Bundler (Vite/Webpack)

```javascript
// src/ai/classifier.ts
import { pipeline } from '@huggingface/transformers';

let classifier: any = null;

export async function initClassifier() {
  if (!classifier) {
    classifier = await pipeline('sentiment-analysis', 'Xenova/bert-base-multilingual-uncased-sentiment');
  }
  return classifier;
}

export async function classify(text: string) {
  const pipe = await initClassifier();
  return pipe(text);
}
```

### Service Worker Caching

Cache models for offline use:

```javascript
// In your service worker
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('huggingface.co')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open('model-cache').then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
  }
});
```

### Loading State Management

```javascript
// React hook pattern
function usePipeline(task: string, model?: string) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    pipeline(task, model)
      .then(setPipeline)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [task, model]);

  return { pipeline, loading, error };
}
```

---

## Common Model Recommendations

| Task | Model | Size |
|------|-------|------|
| Text Classification | `Xenova/distilbert-base-uncased-finetuned-sst-2-english` | ~67MB |
| Sentiment (multilingual) | `Xenova/bert-base-multilingual-uncased-sentiment` | ~700MB |
| NER | `Xenova/bert-base-NER` | ~680MB |
| Feature Extraction | `Xenova/all-MiniLM-L6-v2` | ~23MB |
| Translation (EN-FR) | `Xenova/t5-small` | ~250MB |
| Image Classification | `Xenova/mobilenet_v2_1.0_224` | ~14MB |
| Object Detection | `Xenova/detr-resnet-50` | ~170MB |

---

## Architecture for Real-Time Apps

```
User Input
    |
    v
[Client-Side Model]  <-- Transformers.js + WASM/WebGPU
    |
    v
[Embedding/Classification Result]
    |
    +--> [Local Cache] (IndexedDB for embeddings)
    |
    +--> [Server API] (for storage, matching, moderation)
    |
    v
[Response to UI]
```

Key principle: Run inference on the client, send only the results to the server. This reduces latency, costs, and privacy concerns.

---

## Quick Reference

```javascript
// Basic pipeline creation
const pipe = await pipeline(task, model, options);

// Task-specific usage
const result = await pipe(input, options);

// Options
{
  device: 'wasm' | 'webgpu',
  dtype: 'fp32' | 'fp16' | 'q8' | 'q4',
  progress_callback: (p) => console.log(p),
}
```
