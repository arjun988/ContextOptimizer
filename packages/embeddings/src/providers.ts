import { createHash } from "node:crypto";
import type { Embedder, EmbeddingRequest, EmbeddingResult } from "@contextoptimizer/core";
import { EmbeddingError } from "@contextoptimizer/core";

const DIMENSIONS = 384;

function hashToVector(text: string, dimensions: number): number[] {
  const hash = createHash("sha256").update(text).digest();
  const vector: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    const byte = hash[i % hash.length] ?? 0;
    vector.push(byte / 127.5 - 1);
  }
  return vector;
}

export class FakeEmbedder implements Embedder {
  readonly provider = "fake";
  readonly model: string;
  readonly dimensions: number;

  constructor(model = "fake-embedding-v1", dimensions = DIMENSIONS) {
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      embeddings: request.texts.map((t) => hashToVector(t, this.dimensions)),
      model: this.model,
      provider: this.provider,
      dimensions: this.dimensions,
    };
  }
}

export class LocalEmbedder implements Embedder {
  readonly provider = "local";
  readonly model: string;
  readonly dimensions: number;

  constructor(model = "local-hash-v1", dimensions = DIMENSIONS) {
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      embeddings: request.texts.map((t) => hashToVector(`${this.model}:${t}`, this.dimensions)),
      model: this.model,
      provider: this.provider,
      dimensions: this.dimensions,
    };
  }
}

export interface OpenAIEmbedderOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  batchSize?: number;
  maxRetries?: number;
}

export class OpenAIEmbedder implements Embedder {
  readonly provider = "openai";
  readonly model: string;
  readonly dimensions = 1536;
  private batchSize: number;
  private maxRetries: number;

  constructor(private readonly options: OpenAIEmbedderOptions) {
    this.model = options.model ?? "text-embedding-3-small";
    this.batchSize = options.batchSize ?? 64;
    this.maxRetries = options.maxRetries ?? 3;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < request.texts.length; i += this.batchSize) {
      const batch = request.texts.slice(i, i + this.batchSize);
      const embeddings = await this.embedBatchWithRetry(batch);
      allEmbeddings.push(...embeddings);
    }

    return {
      embeddings: allEmbeddings,
      model: this.model,
      provider: this.provider,
      dimensions: this.dimensions,
    };
  }

  private async embedBatchWithRetry(texts: string[]): Promise<number[][]> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(
          `${this.options.baseUrl ?? "https://api.openai.com/v1"}/embeddings`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.options.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: this.model, input: texts }),
          },
        );

        if (!response.ok) {
          throw new EmbeddingError(`OpenAI API error: ${response.status} ${await response.text()}`);
        }

        const data = (await response.json()) as {
          data: Array<{ embedding: number[] }>;
        };
        return data.data.map((d) => d.embedding);
      } catch (error) {
        lastError = error;
        await new Promise((r) => setTimeout(r, 2 ** attempt * 100));
      }
    }

    throw new EmbeddingError("OpenAI embedding failed after retries", lastError);
  }
}

export interface VoyageEmbedderOptions {
  apiKey: string;
  model?: string;
  batchSize?: number;
  maxRetries?: number;
}

export class VoyageEmbedder implements Embedder {
  readonly provider = "voyage";
  readonly model: string;
  readonly dimensions = 1024;
  private batchSize: number;
  private maxRetries: number;

  constructor(private readonly options: VoyageEmbedderOptions) {
    this.model = options.model ?? "voyage-code-2";
    this.batchSize = options.batchSize ?? 64;
    this.maxRetries = options.maxRetries ?? 3;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < request.texts.length; i += this.batchSize) {
      const batch = request.texts.slice(i, i + this.batchSize);
      let lastError: unknown;

      for (let attempt = 0; attempt < this.maxRetries; attempt++) {
        try {
          const response = await fetch("https://api.voyageai.com/v1/embeddings", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.options.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: this.model, input: batch }),
          });

          if (!response.ok) {
            throw new EmbeddingError(`Voyage API error: ${response.status}`);
          }

          const data = (await response.json()) as {
            data: Array<{ embedding: number[] }>;
          };
          allEmbeddings.push(...data.data.map((d) => d.embedding));
          break;
        } catch (error) {
          lastError = error;
          await new Promise((r) => setTimeout(r, 2 ** attempt * 100));
        }
      }

      if (allEmbeddings.length < i + batch.length) {
        throw new EmbeddingError("Voyage embedding failed after retries", lastError);
      }
    }

    return {
      embeddings: allEmbeddings,
      model: this.model,
      provider: this.provider,
      dimensions: this.dimensions,
    };
  }
}

export class CachedEmbedder implements Embedder {
  readonly provider: string;
  readonly model: string;
  readonly dimensions: number;

  constructor(
    private readonly inner: Embedder,
    private readonly cache: {
      get(key: string): Promise<number[] | null>;
      set(key: string, value: number[]): Promise<void>;
    },
  ) {
    this.provider = inner.provider;
    this.model = inner.model;
    this.dimensions = inner.dimensions;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    for (let i = 0; i < request.texts.length; i++) {
      const text = request.texts[i];
      if (!text) continue;
      const key = `${this.provider}:${this.model}:${createHash("sha256").update(text).digest("hex")}`;
      const cached = await this.cache.get(key);
      if (cached) {
        results[i] = cached;
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(i);
      }
    }

    if (uncachedTexts.length > 0) {
      const embedded = await this.inner.embed({ texts: uncachedTexts, model: request.model });
      for (let j = 0; j < uncachedTexts.length; j++) {
        const idx = uncachedIndices[j]!;
        const vector = embedded.embeddings[j]!;
        results[idx] = vector;
        const text = uncachedTexts[j]!;
        const key = `${this.provider}:${this.model}:${createHash("sha256").update(text).digest("hex")}`;
        await this.cache.set(key, vector);
      }
    }

    return {
      embeddings: results,
      model: this.model,
      provider: this.provider,
      dimensions: this.dimensions,
    };
  }
}
