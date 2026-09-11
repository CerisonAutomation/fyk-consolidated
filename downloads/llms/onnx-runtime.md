# ONNX Runtime Web Deployment Patterns

> Practical implementation patterns for deploying ONNX models in the browser with optimal performance.

## Overview

ONNX Runtime Web enables running ONNX models directly in the browser or Node.js. It supports multiple execution backends (WASM, WebGL, WebGPU, WebNN) and provides optimized inference across different hardware.

**Package:** `onnxruntime-web`
**Docs:** https://onnxruntime.ai/docs/tutorials/web/

---

## Installation

```bash
npm install onnxruntime-web
```

---

## Backend Selection

| Backend | Device | Operator Support | Best For |
|---------|--------|-----------------|----------|
| **WebAssembly (WASM)** | CPU | All ONNX operators | Compatibility, all models |
| **WebGL** | GPU | Subset | Broad GPU support |
| **WebGPU** | GPU | Growing subset | Modern browsers, best perf |
| **WebNN** | CPU/GPU | Subset | Emerging standard |

---

## Core API Patterns

### 1. Basic Session Creation and Inference

```javascript
import * as ort from 'onnxruntime-web';

// Create session from model file
const session = await ort.InferenceSession.create('./model.onnx');

// Create input tensor
const inputTensor = new ort.Tensor('float32', inputData, [1, 3, 224, 224]);

// Run inference
const results = await session.run({ input: inputTensor });

// Extract output
const output = results.output.data;
```

### 2. Multi-Input Model

```javascript
const session = await ort.InferenceSession.create('./model.onnx');

// Prepare multiple inputs
const inputIds = new ort.Tensor('int64', idsArray, [1, sequenceLength]);
const attentionMask = new ort.Tensor('int64', maskArray, [1, sequenceLength]);

// Run with named inputs
const results = await session.run({
  input_ids: inputIds,
  attention_mask: attentionMask,
});

// Access specific output
const logits = results.logits.data;
```

### 3. WebGPU Acceleration

```javascript
import * as ort from 'onnxruntime-web';

// Create session with WebGPU backend
const session = await ort.InferenceSession.create('./model.onnx', {
  executionProviders: ['webgpu'],
});

// Fallback to WASM if WebGPU unavailable
const session = await ort.InferenceSession.create('./model.onnx', {
  executionProviders: ['webgpu', 'wasm'],
});
```

### 4. Multiple Execution Providers

```javascript
// Try providers in order of preference
const session = await ort.InferenceSession.create('./model.onnx', {
  executionProviders: [
    'webgpu',     // Try GPU first
    'webgl',      // Then WebGL
    'wasm',       // CPU fallback
  ],
});
```

---

## Production Patterns

### 1. Model Loading with Progress

```javascript
import * as ort from 'onnxruntime-web';

async function loadModelWithProgress(modelUrl, onProgress) {
  // Fetch model with progress tracking
  const response = await fetch(modelUrl);
  const contentLength = response.headers.get('content-length');
  const total = parseInt(contentLength, 10);

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.round((received / total) * 100));
  }

  const modelBuffer = new Uint8Array(
    chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  );
  let offset = 0;
  for (const chunk of chunks) {
    modelBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  return ort.InferenceSession.create(modelBuffer);
}
```

### 2. Image Preprocessing (MobileNet)

```javascript
function preprocessImage(imageElement, targetSize = [224, 224]) {
  const canvas = document.createElement('canvas');
  const [width, height] = targetSize;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageElement, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  // Convert to CHW format and normalize
  const Float32Array = new Float32Array(3 * width * height);
  for (let i = 0; i < width * height; i++) {
    Float32Array[i] = data[i * 4] / 255.0;           // R
    Float32Array[width * height + i] = data[i * 4 + 1] / 255.0; // G
    Float32Array[2 * width * height + i] = data[i * 4 + 2] / 255.0; // B
  }

  return new ort.Tensor('float32', Float32Array, [1, 3, height, width]);
}
```

### 3. Text Tokenization for NLP Models

```javascript
import { pipeline } from '@huggingface/transformers';

// Use Transformers.js tokenizer + ONNX Runtime for inference
async function textClassification(text, modelSession) {
  const tokenizer = await pipeline('feature-extraction', 'Xenova/bert-base-uncased');

  const output = await tokenizer(text, {
    padding: true,
    truncation: true,
    max_length: 128,
  });

  const inputIds = new ort.Tensor(
    'int64',
    BigInt64Array.from(output.input_ids.data),
    output.input_ids.dims
  );

  const attentionMask = new ort.Tensor(
    'int64',
    BigInt64Array.from(output.attention_mask.data),
    output.attention_mask.dims
  );

  const results = await modelSession.run({
    input_ids: inputIds,
    attention_mask: attentionMask,
  });

  return results;
}
```

### 4. Session Pooling for Concurrent Inference

```javascript
class SessionPool {
  constructor(modelUrl, poolSize = 3) {
    this.sessions = [];
    this.available = [];
    this.init(modelUrl, poolSize);
  }

  async init(modelUrl, poolSize) {
    for (let i = 0; i < poolSize; i++) {
      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['webgpu', 'wasm'],
      });
      this.sessions.push(session);
      this.available.push(session);
    }
  }

  async run(inputs) {
    while (this.available.length === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }

    const session = this.available.pop();
    try {
      return await session.run(inputs);
    } finally {
      this.available.push(session);
    }
  }
}

// Usage
const pool = new SessionPool('./model.onnx', 3);
const results = await pool.run({ input: tensor });
```

---

## Model Optimization

### ORT Format (Recommended)

Convert models to ORT format for optimized binary size and faster loading:

```bash
# Install ort-format optimizer
pip install onnxruntime-tools

# Convert and optimize
python -m onnxruntime.tools.convert_onnx_models_to_ort \
  --optimize \
  model.onnx
```

**Benefits:**
- Optimized model binary size
- Faster initialization
- Lower peak memory usage

### Custom Build (Reduce Bundle Size)

Create a custom ONNX Runtime package that only includes operators your model needs:

```javascript
// Custom build config
{
  "models": ["./model.onnx"],
  "providers": ["webgpu", "wasm"]
}
```

This significantly reduces the ONNX Runtime library size.

---

## WebGL Performance Tuning

### 1. Texture Format Selection

```javascript
const session = await ort.InferenceSession.create('./model.onnx', {
  executionProviders: [{
    name: 'webgl',
    format: 'NCHW',  // or 'NHWC' depending on model
  }],
});
```

### 2. Optimize Texture Memory

- Use FP16 textures when possible
- Minimize texture read/write operations
- Avoid unnecessary data transfers between CPU and GPU

### 3. Profiling

```javascript
const session = await ort.InferenceSession.create('./model.onnx', {
  enableProfiling: true,
});

await session.run(inputs);
const profilingData = session.endProfiling();

// Analyze profiling data
console.log(profilingData);
```

---

## WebGPU Performance Tips

### 1. Check WebGPU Support

```javascript
if (navigator.gpu) {
  const adapter = await navigator.gpu.requestAdapter();
  if (adapter) {
    // WebGPU available
    const session = await ort.InferenceSession.create('./model.onnx', {
      executionProviders: ['webgpu'],
    });
  }
}
```

### 2. Optimize Shader Compilation

```javascript
// Warm up the session with a dummy inference
const dummyInput = new ort.Tensor('float32', new Float32Array(inputSize), inputDims);
await session.run({ input: dummyInput });
```

### 3. Memory Management

```javascript
// Dispose tensors after use
const tensor = new ort.Tensor('float32', data, dims);
await session.run({ input: tensor });
tensor.dispose();  // Free GPU memory
```

---

## Error Handling

```javascript
async function safeInference(modelUrl, inputs) {
  try {
    const session = await ort.InferenceSession.create(modelUrl);
    const results = await session.run(inputs);
    return { success: true, data: results };
  } catch (error) {
    if (error.message.includes('WebGPU')) {
      console.warn('WebGPU not available, falling back to WASM');
      return fallbackInference(modelUrl, inputs);
    }
    throw error;
  }
}

async function fallbackInference(modelUrl, inputs) {
  const session = await ort.InferenceSession.create(modelUrl, {
    executionProviders: ['wasm'],
  });
  return session.run(inputs);
}
```

---

## Integration with React/Next.js

```javascript
// hooks/useOnnxModel.ts
import { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

export function useOnnxModel(modelUrl: string) {
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      sessionRef.current = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['webgpu', 'wasm'],
      });
      setReady(true);
    }
    load();
  }, [modelUrl]);

  const run = async (inputs: Record<string, ort.Tensor>) => {
    if (!sessionRef.current) throw new Error('Model not loaded');
    return sessionRef.current.run(inputs);
  };

  return { ready, run };
}

// Usage in component
function ImageClassifier() {
  const { ready, run } = useOnnxModel('/models/mobilenet.onnx');

  const classify = async (imageElement: HTMLImageElement) => {
    if (!ready) return;
    const tensor = preprocessImage(imageElement);
    const results = await run({ input: tensor });
    return postprocess(results);
  };

  return <div>{ready ? 'Ready' : 'Loading model...'}</div>;
}
```

---

## Deployment Checklist

1. **Convert model to ORT format** for optimized performance
2. **Choose execution providers** with WASM fallback
3. **Implement progress callbacks** for model loading UX
4. **Use quantized models** (FP16 or INT8) for smaller bundle
5. **Cache models** in IndexedDB or service worker
6. **Profile and tune** WebGL/WebGPU settings
7. **Test across browsers** - WebGPU support varies
8. **Implement error handling** with graceful degradation

---

## Quick Reference

```javascript
import * as ort from 'onnxruntime-web';

// Create session
const session = await ort.InferenceSession.create(modelPath, options);

// Create tensor
const tensor = new ort.Tensor(type, data, dims);

// Run inference
const results = await session.run({ inputName: tensor });

// Get output
const output = results.outputName.data;

// Dispose
tensor.dispose();
```
