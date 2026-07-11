export interface Metrics {
  retrievedTokens: number;
  compressedTokens: number;
  savedTokens: number;
  latencyMs: number;
  cacheHits: number;
  cacheMisses: number;
  embeddingLatencyMs: number;
  rankingLatencyMs: number;
}
