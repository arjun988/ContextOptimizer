import { join } from "node:path";
import { MemoryCache } from "@contextoptimizer/cache";
import type {
  ContextRequest,
  ContextResponse,
  Embedder,
  IndexResult,
  ParseResult,
  SearchQuery,
  SearchResult,
  SymbolQuery,
} from "@contextoptimizer/core";
import { FakeEmbedder } from "@contextoptimizer/embeddings";
import { createGraph } from "@contextoptimizer/graph";
import { createIndexer } from "@contextoptimizer/indexer";
import { createLogger } from "@contextoptimizer/observability";
import { createParser } from "@contextoptimizer/parser";
import { createRanker } from "@contextoptimizer/ranking";
import { createContextRetriever, createSemanticSearch } from "@contextoptimizer/retrieval";
import { createSqliteStorage } from "@contextoptimizer/storage";
import { createTokenCounter } from "@contextoptimizer/tokenizer";
import { createInMemoryVectorStore } from "@contextoptimizer/vector-store";

export interface EngineConfig {
  repoPath: string;
  dataDir?: string;
  embedder?: Embedder;
  defaultBudget?: number;
}

export class ContextOptimizerEngine {
  private storage: ReturnType<typeof createSqliteStorage>;
  private indexer: ReturnType<typeof createIndexer>;
  private graph: ReturnType<typeof createGraph>;
  private semanticSearch: ReturnType<typeof createSemanticSearch>;
  private retriever: ReturnType<typeof createContextRetriever>;
  private vectorStore: ReturnType<typeof createInMemoryVectorStore>;
  private astCache = new MemoryCache<ParseResult>();
  private embeddingCache = new MemoryCache<number[]>();
  private retrievalCache = new MemoryCache<ContextResponse>();
  private logger = createLogger({ name: "engine" });

  constructor(private readonly config: EngineConfig) {
    const dataDir = config.dataDir ?? join(config.repoPath, ".contextoptimizer");
    const dbPath = join(dataDir, "index.db");

    this.storage = createSqliteStorage(dbPath);
    const parser = createParser();
    const embedder = config.embedder ?? new FakeEmbedder();

    this.indexer = createIndexer({
      storage: this.storage,
      parser,
      astCache: this.astCache,
    });

    this.graph = createGraph({
      storage: this.storage,
      repoPath: config.repoPath,
    });

    this.vectorStore = createInMemoryVectorStore();

    this.semanticSearch = createSemanticSearch({
      storage: this.storage,
      embedder,
      vectorStore: this.vectorStore,
    });

    const ranker = createRanker();
    const tokenCounter = createTokenCounter();

    this.retriever = createContextRetriever({
      storage: this.storage,
      search: this.semanticSearch,
      graph: this.graph,
      ranker,
      tokenCounter,
      retrievalCache: this.retrievalCache,
      repoPath: config.repoPath,
      defaultBudget: config.defaultBudget,
    });
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
    await this.vectorStore.initialize();
    this.logger.info({ repoPath: this.config.repoPath }, "Engine initialized");
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
    return this.retriever.getContext(request);
  }

  async neighbors(nodeId: string, depth = 1) {
    return this.graph.neighbors({ nodeId, depth });
  }
}

export function createEngine(config: EngineConfig): ContextOptimizerEngine {
  return new ContextOptimizerEngine(config);
}

export { FakeEmbedder, createParser, createSqliteStorage, createTokenCounter };
