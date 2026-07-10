import type { CacheAdapter } from "@contextoptimizer/core";

interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

export class MemoryCache<T> implements CacheAdapter<T> {
  private store = new Map<string, CacheEntry<T>>();

  async get(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async invalidateByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

export function createAstCacheKey(fileHash: string): string {
  return `ast:${fileHash}`;
}

export function createEmbeddingCacheKey(
  provider: string,
  model: string,
  chunkHash: string,
): string {
  return `embedding:${provider}:${model}:${chunkHash}`;
}

export function createRetrievalCacheKey(repoPath: string, requestHash: string): string {
  return `retrieval:${repoPath}:${requestHash}`;
}
