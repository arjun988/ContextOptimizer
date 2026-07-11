import { createHash } from "node:crypto";
import type { Embedder, EmbeddingRequest, EmbeddingResult } from "@contextoptimizer/core";
import { tokenizeForSearch } from "@contextoptimizer/core";

const DEFAULT_DIMENSIONS = 384;

function hashToken(token: string, dimensions: number): number[] {
  const digest = createHash("sha256").update(token).digest();
  const indices = [
    digest[0]! % dimensions,
    digest[1]! % dimensions,
    digest[2]! % dimensions,
    digest[3]! % dimensions,
  ];
  const signs = [
    (digest[4]! & 1) === 0 ? 1 : -1,
    (digest[5]! & 1) === 0 ? 1 : -1,
    (digest[6]! & 1) === 0 ? 1 : -1,
    (digest[7]! & 1) === 0 ? 1 : -1,
  ];

  const vector = new Array<number>(dimensions).fill(0);
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]!;
    vector[idx] = (vector[idx] ?? 0) + signs[i]!;
  }

  return vector;
}

function addVectors(a: number[], b: number[]): number[] {
  const result = [...a];
  for (let i = 0; i < b.length; i++) {
    result[i] = (result[i] ?? 0) + (b[i] ?? 0);
  }
  return result;
}

function scaleVector(vector: number[], factor: number): number[] {
  return vector.map((value) => value * factor);
}

function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

function buildFeatureVector(text: string, dimensions: number): number[] {
  const tokens = tokenizeForSearch(text);
  if (tokens.length === 0) {
    return new Array<number>(dimensions).fill(0);
  }

  const termFreq = new Map<string, number>();
  for (const token of tokens) {
    termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
  }

  let vector = new Array<number>(dimensions).fill(0);
  for (const [token, freq] of termFreq) {
    const weight = 1 + Math.log(freq);
    vector = addVectors(vector, scaleVector(hashToken(token, dimensions), weight));
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    vector = addVectors(vector, scaleVector(hashToken(bigram, dimensions), 0.5));
  }

  return normalizeVector(vector);
}

export class CodeAwareEmbedder implements Embedder {
  readonly provider = "local";
  readonly model: string;
  readonly dimensions: number;

  constructor(model = "code-aware-v1", dimensions = DEFAULT_DIMENSIONS) {
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      embeddings: request.texts.map((text) => buildFeatureVector(text, this.dimensions)),
      model: this.model,
      provider: this.provider,
      dimensions: this.dimensions,
    };
  }
}
