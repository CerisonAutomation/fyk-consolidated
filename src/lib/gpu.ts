/**
 * WebGPU compute path for similarity search.
 *
 * Ranking N profiles against a query embedding is an embarrassingly parallel
 * dot-product problem — exactly what a GPU is for. This dispatches a WGSL
 * compute shader over the whole corpus in one pass and falls back to a tight
 * typed-array loop on the CPU when WebGPU isn't there.
 *
 * Vectors are L2-normalised on the way in, so a dot product is the cosine.
 */

const WGSL = /* wgsl */ `
struct Params {
  count : u32,
  dim   : u32,
};

@group(0) @binding(0) var<storage, read>       corpus : array<f32>;
@group(0) @binding(1) var<storage, read>       query  : array<f32>;
@group(0) @binding(2) var<storage, read_write> scores : array<f32>;
@group(0) @binding(3) var<uniform>             params : Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let row : u32 = gid.x;
  if (row >= params.count) { return; }

  let base : u32 = row * params.dim;
  var acc : f32 = 0.0;

  // Four-wide accumulation keeps the ALUs busy and cuts loop overhead.
  var i : u32 = 0u;
  let limit : u32 = params.dim - (params.dim % 4u);
  loop {
    if (i >= limit) { break; }
    acc = acc
      + corpus[base + i]      * query[i]
      + corpus[base + i + 1u] * query[i + 1u]
      + corpus[base + i + 2u] * query[i + 2u]
      + corpus[base + i + 3u] * query[i + 3u];
    i = i + 4u;
  }
  loop {
    if (i >= params.dim) { break; }
    acc = acc + corpus[base + i] * query[i];
    i = i + 1u;
  }

  scores[row] = acc;
}
`;

export type GpuInfo = {
  available: boolean;
  adapter: string;
  backend: string;
  maxWorkgroups: number;
  reason?: string;
};

class GpuEngine {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private initTried = false;

  info: GpuInfo = { available: false, adapter: "—", backend: "cpu", maxWorkgroups: 0, reason: "Not initialised" };

  get supported() {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  async init(): Promise<GpuInfo> {
    if (this.device) return this.info;
    if (this.initTried && !this.device) return this.info;
    this.initTried = true;

    if (!this.supported) {
      this.info = { available: false, adapter: "—", backend: "cpu", maxWorkgroups: 0, reason: "WebGPU not exposed by this browser" };
      return this.info;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) throw new Error("No GPU adapter available");
      const device = await adapter.requestDevice();
      const module = device.createShaderModule({ code: WGSL, label: "fyk-similarity" });
      this.pipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module, entryPoint: "main" },
        label: "fyk-similarity-pipeline",
      });
      this.device = device;

      const adapterInfo = (adapter as GPUAdapter & { info?: { vendor?: string; architecture?: string; description?: string } }).info;
      const name = [adapterInfo?.vendor, adapterInfo?.architecture].filter(Boolean).join(" ") || adapterInfo?.description || "GPU adapter";

      this.info = {
        available: true,
        adapter: name,
        backend: "webgpu",
        maxWorkgroups: device.limits.maxComputeWorkgroupsPerDimension,
      };
      device.lost.then(() => {
        this.device = null;
        this.pipeline = null;
        this.info = { ...this.info, available: false, backend: "cpu", reason: "Device lost" };
      });
    } catch (e) {
      this.info = {
        available: false, adapter: "—", backend: "cpu", maxWorkgroups: 0,
        reason: (e as Error).message || "Adapter request failed",
      };
    }
    return this.info;
  }

  /** Returns one cosine score per row. `corpus` is count × dim, row-major. */
  async similarity(corpus: Float32Array<ArrayBuffer>, query: Float32Array<ArrayBuffer>, count: number, dim: number): Promise<Float32Array> {
    const device = this.device;
    const pipeline = this.pipeline;
    if (!device || !pipeline || count === 0) return cpuSimilarity(corpus, query, count, dim);

    const pad = (n: number) => Math.max(16, Math.ceil(n / 4) * 4);

    const corpusBuf = device.createBuffer({ size: pad(corpus.byteLength), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const queryBuf = device.createBuffer({ size: pad(query.byteLength), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const scoreBuf = device.createBuffer({ size: pad(count * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const readBuf = device.createBuffer({ size: pad(count * 4), usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const paramBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    device.queue.writeBuffer(corpusBuf, 0, corpus);
    device.queue.writeBuffer(queryBuf, 0, query);
    device.queue.writeBuffer(paramBuf, 0, new Uint32Array([count, dim, 0, 0]));

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: corpusBuf } },
        { binding: 1, resource: { buffer: queryBuf } },
        { binding: 2, resource: { buffer: scoreBuf } },
        { binding: 3, resource: { buffer: paramBuf } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();
    encoder.copyBufferToBuffer(scoreBuf, 0, readBuf, 0, pad(count * 4));
    device.queue.submit([encoder.finish()]);

    try {
      await readBuf.mapAsync(GPUMapMode.READ);
      const out = new Float32Array(readBuf.getMappedRange().slice(0, count * 4));
      readBuf.unmap();
      return out;
    } finally {
      [corpusBuf, queryBuf, scoreBuf, readBuf, paramBuf].forEach((b) => b.destroy());
    }
  }

  /** Times both paths over a synthetic corpus so the speed-up is measured, not asserted. */
  async benchmark(count = 4096, dim = 384): Promise<{ gpuMs: number; cpuMs: number; speedup: number; count: number; dim: number }> {
    const corpus = new Float32Array(new ArrayBuffer(count * dim * 4));
    for (let i = 0; i < corpus.length; i++) corpus[i] = Math.random() * 2 - 1;
    normaliseRows(corpus, count, dim);
    const query = new Float32Array(new ArrayBuffer(dim * 4));
    for (let i = 0; i < dim; i++) query[i] = Math.random() * 2 - 1;
    normaliseRows(query, 1, dim);

    await this.init();

    let gpuMs = 0;
    if (this.device) {
      await this.similarity(corpus, query, Math.min(count, 256), dim); // warm-up
      const t0 = performance.now();
      await this.similarity(corpus, query, count, dim);
      gpuMs = performance.now() - t0;
    }

    const t1 = performance.now();
    cpuSimilarity(corpus, query, count, dim);
    const cpuMs = performance.now() - t1;

    return {
      gpuMs: Math.round(gpuMs * 100) / 100,
      cpuMs: Math.round(cpuMs * 100) / 100,
      speedup: gpuMs > 0 ? Math.round((cpuMs / gpuMs) * 10) / 10 : 0,
      count,
      dim,
    };
  }
}

export function cpuSimilarity(corpus: Float32Array<ArrayBuffer>, query: Float32Array<ArrayBuffer>, count: number, dim: number): Float32Array {
  const out = new Float32Array(count);
  for (let r = 0; r < count; r++) {
    const base = r * dim;
    let acc = 0;
    for (let i = 0; i < dim; i++) acc += corpus[base + i]! * query[i]!;
    out[r] = acc;
  }
  return out;
}

/** L2-normalise each row in place so dot products are cosines. */
export function normaliseRows(data: Float32Array<ArrayBuffer>, count: number, dim: number) {
  for (let r = 0; r < count; r++) {
    const base = r * dim;
    let sum = 0;
    for (let i = 0; i < dim; i++) sum += data[base + i]! * data[base + i]!;
    const norm = Math.sqrt(sum) || 1;
    for (let i = 0; i < dim; i++) data[base + i] = data[base + i]! / norm;
  }
}

export const gpu = new GpuEngine();
