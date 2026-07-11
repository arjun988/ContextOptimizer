import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { MemoryCache } from "@contextoptimizer/cache";
import { createCompressionPipeline } from "@contextoptimizer/compression";
import type {
  BudgetRequest,
  BudgetResponse,
  CompressRequest,
  CompressionResult,
  ContextRequest,
  ContextResponse,
  Embedder,
  IndexResult,
  MemoryEntry,
  MemoryQuery,
  ParseResult,
  SearchQuery,
  SearchResult,
  StorageAdapter,
  SymbolQuery,
  VectorStore,
} from "@contextoptimizer/core";
import { createDefaultEmbedder } from "@contextoptimizer/embeddings";
import { createGraph } from "@contextoptimizer/graph";
import { createIndexer } from "@contextoptimizer/indexer";
import { createMemoryStore } from "@contextoptimizer/memory";
import { createLogger, createMetricsCollector } from "@contextoptimizer/observability";
import { createParser } from "@contextoptimizer/parser";
import { createRanker } from "@contextoptimizer/ranking";
import { createContextRetriever, createSemanticSearch } from "@contextoptimizer/retrieval";
import { createSqliteStorage } from "@contextoptimizer/storage";
import { BudgetManager, createTokenCounter } from "@contextoptimizer/tokenizer";
import { createInMemoryVectorStore } from "@contextoptimizer/vector-store";

export interface EngineConfig {
  repoPath: string;
  dataDir?: string;
  databaseUrl?: string;
  storage?: StorageAdapter;
  vectorStore?: VectorStore;
  usePgVector?: boolean;
  embedder?: Embedder;
  defaultBudget?: number;
}

export class ContextOptimizerEngine {
  private storage: StorageAdapter;
  private indexer: ReturnType<typeof createIndexer>;
  private graph: ReturnType<typeof createGraph>;
  private semanticSearch: ReturnType<typeof createSemanticSearch>;
  private retriever: ReturnType<typeof createContextRetriever>;
  private vectorStore: VectorStore;
  private compression: ReturnType<typeof createCompressionPipeline>;
  private memory: ReturnType<typeof createMemoryStore>;
  private tokenCounter: ReturnType<typeof createTokenCounter>;
  private budgetManager: BudgetManager;
  private metrics = createMetricsCollector();
  private astCache = new MemoryCache<ParseResult>();
  private embeddingCache = new MemoryCache<number[]>();
  private retrievalCache = new MemoryCache<ContextResponse>();
  private summaryCache = new MemoryCache<string>();
  private logger = createLogger({ name: "engine" });
  private readonly dataDir: string;

  constructor(private readonly config: EngineConfig) {
    this.dataDir = config.dataDir ?? join(config.repoPath, ".contextoptimizer");
    mkdirSync(this.dataDir, { recursive: true });
    const dbPath = join(this.dataDir, "index.db");

    this.storage = config.storage ?? createSqliteStorage(dbPath);
    const parser = createParser();
    const embedder = config.embedder ?? createDefaultEmbedder();

    this.indexer = createIndexer({
      storage: this.storage,
      parser,
      astCache: this.astCache,
    });

    this.graph = createGraph({
      storage: this.storage,
      repoPath: config.repoPath,
    });

    this.vectorStore = config.vectorStore ?? createInMemoryVectorStore();
    this.tokenCounter = createTokenCounter();
    this.budgetManager = new BudgetManager(this.tokenCounter, config.defaultBudget);
    this.compression = createCompressionPipeline({ tokenCounter: this.tokenCounter });
    this.memory = createMemoryStore(this.storage);

    this.semanticSearch = createSemanticSearch({
      storage: this.storage,
      embedder,
      vectorStore: this.vectorStore,
    });

    const ranker = createRanker();

    this.retriever = createContextRetriever({
      storage: this.storage,
      search: this.semanticSearch,
      graph: this.graph,
      ranker,
      tokenCounter: this.tokenCounter,
      retrievalCache: this.retrievalCache,
      repoPath: config.repoPath,
      defaultBudget: config.defaultBudget,
    });
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
    await this.vectorStore.initialize();
    await this.warmVectorStore();
    this.logger.info({ repoPath: this.config.repoPath }, "Engine initialized");
  }

  private async warmVectorStore(): Promise<void> {
    const chunks = await this.storage.getChunks();
    if (chunks.length > 0) {
      await this.semanticSearch.indexChunks(chunks);
    }
  }

  async close(): Promise<void> {
    await this.vectorStore.close();
    await this.storage.close();
  }

  async index(options?: { force?: boolean }): Promise<IndexResult> {
    const result = await this.indexer.index(this.config.repoPath, options);
    await this.graph.rebuild();
    const chunks = await this.storage.getChunks();
    await this.semanticSearch.indexChunks(chunks);
    this.logger.info({ stats: result.stats }, "Index complete");
    return result;
  }

  async getSymbols(query: SymbolQuery) {
    return this.indexer.getSymbols(query);
  }

  async getFile(path: string) {
    return this.indexer.getFile(path);
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    return this.semanticSearch.search(query);
  }

  async getContext(request: ContextRequest): Promise<ContextResponse> {
    const summary = await this.memory.getProjectSummary();
    const enriched: ContextRequest = {
      ...request,
      conversationSummary: [request.conversationSummary, summary].filter(Boolean).join(" "),
    };

    const response = await this.retriever.getContext(enriched);
    this.metrics.recordRetrieval(
      response.totalTokens,
      response.metadata.latencyMs,
      response.metadata.cacheHit,
    );

    await this.memory.remember({
      category: "previous_retrieval",
      key: request.task.slice(0, 100),
      content: JSON.stringify({ snippets: response.snippets.length, tokens: response.totalTokens }),
    });

    return response;
  }

  async compress(request: CompressRequest): Promise<CompressionResult> {
    const cacheKey = `compress:${request.text.slice(0, 64)}:${request.targetTokens ?? 0}`;
    const cached = await this.summaryCache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CompressionResult;
    }

    const result = await this.compression.compress(request);
    this.metrics.recordCompression(result.originalTokens, result.compressedTokens);
    await this.summaryCache.set(cacheKey, JSON.stringify(result));
    return result;
  }

  async budget(request: BudgetRequest): Promise<BudgetResponse> {
    const budget = request.budget;
    const withTokens = request.snippets.map((s) => ({
      ...s,
      tokenCount: s.tokenCount ?? this.tokenCounter.count(s.content),
    }));
    const { selected, totalTokens } = this.budgetManager.fillWithinBudget(withTokens, budget);
    return {
      snippets: selected,
      totalTokens,
      budget,
      utilization: budget > 0 ? totalTokens / budget : 0,
    };
  }

  async remember(entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">) {
    return this.memory.remember(entry);
  }

  async recall(query: MemoryQuery) {
    return this.memory.recall(query);
  }

  async getProjectSummary(): Promise<string | null> {
    return this.memory.getProjectSummary();
  }

  async neighbors(nodeId: string, depth = 1) {
    return this.graph.neighbors({ nodeId, depth });
  }

  getMetrics() {
    return this.metrics.getMetrics();
  }

  getPrometheusMetrics(): string {
    return this.metrics.toPrometheus();
  }

  async doctor(): Promise<{ healthy: boolean; checks: Record<string, boolean> }> {
    const files = await this.storage.getAllFiles();
    const chunks = await this.storage.getChunks();
    const vectorCount = await this.vectorStore.count();
    const checks = {
      storage: true,
      indexed: files.length > 0,
      chunks: chunks.length > 0,
      vectors: chunks.length === 0 || vectorCount > 0,
      repoExists: true,
    };
    return { healthy: Object.values(checks).every(Boolean), checks };
  }

  getRepoPath(): string {
    return this.config.repoPath;
  }

  getDataDir(): string {
    return this.dataDir;
  }
}

export function createEngine(config: EngineConfig): ContextOptimizerEngine {
  return new ContextOptimizerEngine(config);
}

export { createDefaultEmbedder, createParser, createSqliteStorage, createTokenCounter };
