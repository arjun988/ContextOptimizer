import { createHash } from "node:crypto";
import { createRetrievalCacheKey } from "@contextoptimizer/cache";
import type { MemoryCache } from "@contextoptimizer/cache";
import {
  type Chunk,
  type ContextRequest,
  type ContextResponse,
  type ContextRetriever,
  type Embedder,
  type GraphService,
  type Ranker,
  type RankingCandidate,
  type RankingContext,
  type SearchQuery,
  type SearchResult,
  type SemanticSearch,
  type StorageAdapter,
  type TokenCounter,
  type VectorStore,
  bm25Score,
  tokenizeForSearch,
} from "@contextoptimizer/core";
import { classifySnippetKind } from "@contextoptimizer/ranking";
import { BudgetManager } from "@contextoptimizer/tokenizer";

export interface HybridSearchOptions {
  storage: StorageAdapter;
  embedder: Embedder;
  vectorStore: VectorStore;
  semanticWeight?: number;
  keywordWeight?: number;
}

export class HybridSemanticSearch implements SemanticSearch {
  private semanticWeight: number;
  private keywordWeight: number;

  constructor(private readonly options: HybridSearchOptions) {
    const prefersKeywords = ["fake", "local"].includes(options.embedder.provider);
    this.semanticWeight = prefersKeywords ? 0.25 : (options.semanticWeight ?? 0.7);
    this.keywordWeight = prefersKeywords ? 0.75 : (options.keywordWeight ?? 0.3);
  }

  async indexChunks(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const texts = chunks.map((c) => c.content);
    const result = await this.options.embedder.embed({ texts });

    await this.options.vectorStore.upsert(
      chunks.map((chunk, i) => ({
        id: chunk.id,
        vector: result.embeddings[i]!,
        metadata: {
          filePath: chunk.filePath,
          symbolId: chunk.symbolId,
          symbolName: chunk.metadata.symbolName,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
        },
      })),
    );
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const limit = query.limit ?? 20;
    const queryTerms = tokenizeForSearch(query.text);
    const allChunks = await this.options.storage.getChunks(query.filePath);

    const docFrequency = new Map<string, number>();
    let totalLength = 0;
    for (const chunk of allChunks) {
      totalLength += tokenizeForSearch(chunk.content).length;
      const seen = new Set<string>();
      for (const term of tokenizeForSearch(chunk.content)) {
        if (!seen.has(term)) {
          docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
          seen.add(term);
        }
      }
    }
    const avgDocLength = allChunks.length > 0 ? totalLength / allChunks.length : 1;

    const keywordScores = new Map<string, number>();
    for (const chunk of allChunks) {
      if (query.language && chunk.language !== query.language) continue;
      const score = bm25Score(
        queryTerms,
        chunk.content,
        avgDocLength,
        docFrequency,
        allChunks.length,
      );
      if (score > 0) keywordScores.set(chunk.id, score);
    }

    const embedResult = await this.options.embedder.embed({ texts: [query.text] });
    const queryVector = embedResult.embeddings[0]!;
    const vectorResults = await this.options.vectorStore.search(
      queryVector,
      limit * 2,
      query.filePath ? { filePath: query.filePath } : undefined,
    );

    const combined = new Map<string, number>();

    const maxKeyword = Math.max(...keywordScores.values(), 1);
    for (const [id, score] of keywordScores) {
      combined.set(id, (score / maxKeyword) * this.keywordWeight);
    }

    for (const result of vectorResults) {
      const existing = combined.get(result.id) ?? 0;
      combined.set(result.id, existing + result.score * this.semanticWeight);
    }

    for (const chunk of allChunks) {
      const symbolName = chunk.metadata.symbolName;
      if (!symbolName) continue;

      const symbolTerms = tokenizeForSearch(symbolName);
      const overlap = queryTerms.filter((term) => symbolTerms.includes(term)).length;
      if (overlap === 0) continue;

      const boost = (overlap / Math.max(queryTerms.length, 1)) * this.keywordWeight;
      combined.set(chunk.id, (combined.get(chunk.id) ?? 0) + boost);
    }

    const sorted = [...combined.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
    const results: SearchResult[] = [];

    for (const [chunkId, score] of sorted) {
      const chunk = await this.options.storage.getChunkById(chunkId);
      if (!chunk) continue;
      results.push({
        chunkId: chunk.id,
        symbolId: chunk.symbolId,
        filePath: chunk.filePath,
        content: chunk.content,
        score,
        symbolName: chunk.metadata.symbolName,
        metadata: chunk.metadata,
      });
    }

    return results;
  }
}

export interface ContextRetrieverOptions {
  storage: StorageAdapter;
  search: SemanticSearch;
  graph: GraphService;
  ranker: Ranker;
  tokenCounter: TokenCounter;
  retrievalCache?: MemoryCache<ContextResponse>;
  repoPath: string;
  defaultBudget?: number;
  candidateLimit?: number;
}

export class ContextRetrievalEngine implements ContextRetriever {
  private budgetManager: BudgetManager;

  constructor(private readonly options: ContextRetrieverOptions) {
    this.budgetManager = new BudgetManager(options.tokenCounter, options.defaultBudget);
  }

  async getContext(request: ContextRequest): Promise<ContextResponse> {
    const start = Date.now();
    const cacheKey = createRetrievalCacheKey(
      this.options.repoPath,
      createHash("sha256").update(JSON.stringify(request)).digest("hex"),
    );

    if (this.options.retrievalCache) {
      const cached = await this.options.retrievalCache.get(cacheKey);
      if (cached) {
        return {
          ...cached,
          metadata: { ...cached.metadata, cacheHit: true, latencyMs: Date.now() - start },
        };
      }
    }

    const searchQuery = this.buildSearchQuery(request);
    const searchResults = await this.options.search.search(searchQuery);

    const graphExpanded = await this.expandWithGraph(searchResults, request);
    const candidates = this.toCandidates(searchResults, graphExpanded);

    const semanticScores = new Map<string, number>();
    for (const result of searchResults) {
      semanticScores.set(result.chunkId, result.score);
    }
    for (const chunk of graphExpanded) {
      if (!semanticScores.has(chunk.id)) {
        semanticScores.set(chunk.id, 0.3);
      }
    }

    const symbolIds = candidates.map((c) => c.symbolId).filter((id): id is string => Boolean(id));
    const popularityScores = await this.options.graph.getPopularityScores(symbolIds);

    const fileIndexedAt = new Map<string, number>();
    const files = await this.options.storage.getAllFiles();
    for (const file of files) {
      fileIndexedAt.set(file.path, file.indexedAt);
    }

    const graphDistances = await this.computeGraphDistances(request, candidates);

    const rankingContext: RankingContext = {
      request,
      semanticScores,
      graphDistances,
      popularityScores,
      fileIndexedAt,
    };

    const ranked = await this.options.ranker.rank(candidates, rankingContext);
    const budget = this.budgetManager.getBudget(request.budget);
    const totalChunks = (await this.options.storage.getChunks()).length;

    const withTokens = ranked.map((item) => ({
      ...item,
      tokenCount: this.options.tokenCounter.count(item.content),
    }));

    const { selected, totalTokens } =
      budget !== undefined
        ? this.budgetManager.fillWithinBudget(withTokens, budget)
        : this.budgetManager.selectAdaptive(withTokens, { totalChunks });
    const limit = request.limit ?? selected.length;

    const snippets = selected.slice(0, limit).map((item) => ({
      id: item.id,
      content: item.content,
      filePath: item.filePath,
      symbolId: item.symbolId,
      score: item.score,
      scores: item.scores,
      tokenCount: item.tokenCount ?? this.options.tokenCounter.count(item.content),
      kind: item.kind,
      startLine: item.startLine,
      endLine: item.endLine,
    }));

    const response: ContextResponse = {
      snippets,
      totalTokens,
      metadata: {
        candidatesConsidered: candidates.length,
        cacheHit: false,
        latencyMs: Date.now() - start,
      },
    };

    if (this.options.retrievalCache) {
      await this.options.retrievalCache.set(cacheKey, response);
    }

    return response;
  }

  private buildSearchQuery(request: ContextRequest): SearchQuery {
    const parts = [request.task];
    if (request.conversationSummary) parts.push(request.conversationSummary);
    return {
      text: parts.join(" "),
      limit: this.options.candidateLimit ?? 30,
      filePath: request.currentFile,
    };
  }

  private async expandWithGraph(
    searchResults: SearchResult[],
    request: ContextRequest,
  ): Promise<Chunk[]> {
    const expanded: Chunk[] = [];
    const seen = new Set<string>();
    const totalChunks = (await this.options.storage.getChunks()).length;
    const isSmallRepo = totalChunks <= 50;
    const seedCount = isSmallRepo ? 2 : 5;
    const neighborDepth = isSmallRepo ? 1 : 2;
    const neighborLimit = isSmallRepo ? 3 : 10;

    if (isSmallRepo && searchResults.length >= 3) {
      if (request.currentFile) {
        const fileChunks = await this.options.storage.getChunks(request.currentFile);
        for (const chunk of fileChunks.slice(0, 2)) {
          if (!seen.has(chunk.id)) {
            seen.add(chunk.id);
            expanded.push(chunk);
          }
        }
      }
      return expanded;
    }

    for (const result of searchResults.slice(0, seedCount)) {
      if (!result.symbolId || result.score < 0.1) continue;
      const neighbors = await this.options.graph.neighbors({
        nodeId: result.symbolId,
        depth: neighborDepth,
        edgeKinds: ["calls", "imports", "references"],
        limit: neighborLimit,
      });

      for (const neighbor of neighbors) {
        if (neighbor.node.kind !== "symbol" || !neighbor.node.filePath) continue;
        const chunks = await this.options.storage.getChunks(neighbor.node.filePath);
        const match = chunks.find((c) => c.symbolId === neighbor.node.id);
        if (match && !seen.has(match.id)) {
          seen.add(match.id);
          expanded.push(match);
        }
      }
    }

    if (request.currentFile) {
      const fileChunks = await this.options.storage.getChunks(request.currentFile);
      for (const chunk of fileChunks.slice(0, 3)) {
        if (!seen.has(chunk.id)) {
          seen.add(chunk.id);
          expanded.push(chunk);
        }
      }
    }

    return expanded;
  }

  private toCandidates(searchResults: SearchResult[], graphExpanded: Chunk[]): RankingCandidate[] {
    const candidates: RankingCandidate[] = [];
    const seen = new Set<string>();

    for (const result of searchResults) {
      if (seen.has(result.chunkId)) continue;
      seen.add(result.chunkId);
      candidates.push({
        id: result.chunkId,
        chunkId: result.chunkId,
        symbolId: result.symbolId,
        filePath: result.filePath,
        content: result.content,
        startLine: result.metadata.startLine,
        endLine: result.metadata.endLine,
        kind: classifySnippetKind(result.filePath),
      });
    }

    for (const chunk of graphExpanded) {
      if (seen.has(chunk.id)) continue;
      seen.add(chunk.id);
      candidates.push({
        id: chunk.id,
        chunkId: chunk.id,
        symbolId: chunk.symbolId,
        filePath: chunk.filePath,
        content: chunk.content,
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        kind: classifySnippetKind(chunk.filePath),
      });
    }

    return candidates;
  }

  private async computeGraphDistances(
    request: ContextRequest,
    candidates: RankingCandidate[],
  ): Promise<Map<string, number>> {
    const distances = new Map<string, number>();

    if (!request.currentFile) return distances;

    const currentFileNodeId = `file:${request.currentFile}`;
    for (const candidate of candidates) {
      const key = candidate.symbolId ?? candidate.filePath;
      if (candidate.symbolId) {
        const neighbors = await this.options.graph.neighbors({
          nodeId: currentFileNodeId,
          depth: 3,
          limit: 100,
        });
        const match = neighbors.find((n) => n.node.id === candidate.symbolId);
        distances.set(key, match?.distance ?? 5);
      } else {
        distances.set(key, candidate.filePath === request.currentFile ? 0 : 3);
      }
    }

    return distances;
  }
}

export function createSemanticSearch(options: HybridSearchOptions): HybridSemanticSearch {
  return new HybridSemanticSearch(options);
}

export function createContextRetriever(options: ContextRetrieverOptions): ContextRetrievalEngine {
  return new ContextRetrievalEngine(options);
}
