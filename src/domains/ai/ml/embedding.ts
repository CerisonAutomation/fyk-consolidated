const SEARCH_DIM = 96;

export function profileVector(text: string, out: Float32Array, offset: number): void {
  for (const token of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!token) continue;
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) h = Math.imul(h ^ token.charCodeAt(i), 16777619);
    out[offset + ((h >>> 0) % SEARCH_DIM)] += 1;
  }
}

export function queryVector(q: string): Float32Array {
  const v = new Float32Array(SEARCH_DIM);
  for (const token of q.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!token) continue;
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) h = Math.imul(h ^ token.charCodeAt(i), 16777619);
    v[(h >>> 0) % SEARCH_DIM] += 1;
  }
  return v;
}

export { SEARCH_DIM };
