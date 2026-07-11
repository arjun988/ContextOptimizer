import type { Metrics } from "./types.js";

export class MetricsCollector {
  private metrics: Metrics;

  constructor(initial?: Partial<Metrics>) {
    this.metrics = {
      retrievedTokens: 0,
      compressedTokens: 0,
      savedTokens: 0,
      latencyMs: 0,
      cacheHits: 0,
      cacheMisses: 0,
      embeddingLatencyMs: 0,
      rankingLatencyMs: 0,
      ...initial,
    };
  }

  recordRetrieval(tokens: number, latencyMs: number, cacheHit: boolean): void {
    this.metrics.retrievedTokens += tokens;
    this.metrics.latencyMs += latencyMs;
    if (cacheHit) this.metrics.cacheHits++;
    else this.metrics.cacheMisses++;
  }

  recordCompression(original: number, compressed: number): void {
    this.metrics.compressedTokens += compressed;
    this.metrics.savedTokens += Math.max(0, original - compressed);
  }

  recordEmbeddingLatency(ms: number): void {
    this.metrics.embeddingLatencyMs += ms;
  }

  recordRankingLatency(ms: number): void {
    this.metrics.rankingLatencyMs += ms;
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  getCacheHitRatio(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? this.metrics.cacheHits / total : 0;
  }

  toPrometheus(): string {
    const m = this.metrics;
    const ratio = this.getCacheHitRatio();
    return [
      "# HELP contextoptimizer_retrieved_tokens Total retrieved tokens",
      "# TYPE contextoptimizer_retrieved_tokens counter",
      `contextoptimizer_retrieved_tokens ${m.retrievedTokens}`,
      "# HELP contextoptimizer_compressed_tokens Total compressed tokens",
      "# TYPE contextoptimizer_compressed_tokens counter",
      `contextoptimizer_compressed_tokens ${m.compressedTokens}`,
      "# HELP contextoptimizer_saved_tokens Total saved tokens",
      "# TYPE contextoptimizer_saved_tokens counter",
      `contextoptimizer_saved_tokens ${m.savedTokens}`,
      "# HELP contextoptimizer_latency_ms Total latency in ms",
      "# TYPE contextoptimizer_latency_ms counter",
      `contextoptimizer_latency_ms ${m.latencyMs}`,
      "# HELP contextoptimizer_cache_hit_ratio Cache hit ratio",
      "# TYPE contextoptimizer_cache_hit_ratio gauge",
      `contextoptimizer_cache_hit_ratio ${ratio.toFixed(4)}`,
      "# HELP contextoptimizer_embedding_latency_ms Embedding latency",
      "# TYPE contextoptimizer_embedding_latency_ms counter",
      `contextoptimizer_embedding_latency_ms ${m.embeddingLatencyMs}`,
      "# HELP contextoptimizer_ranking_latency_ms Ranking latency",
      "# TYPE contextoptimizer_ranking_latency_ms counter",
      `contextoptimizer_ranking_latency_ms ${m.rankingLatencyMs}`,
    ].join("\n");
  }
}

export function createMetricsCollector(initial?: Partial<Metrics>): MetricsCollector {
  return new MetricsCollector(initial);
}
