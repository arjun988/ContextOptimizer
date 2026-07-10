import type {
  Chunk,
  ContextRequest,
  ContextResponse,
  EmbeddingRequest,
  EmbeddingResult,
  FileRecord,
  GraphEdge,
  GraphNeighbor,
  GraphNode,
  ImportRecord,
  IndexResult,
  NeighborQuery,
  ParseResult,
  RankingCandidate,
  RankingContext,
  RankingWeights,
  ReferenceRecord,
  SearchQuery,
  SearchResult,
  Symbol,
  SymbolQuery,
} from "./types.js";

export interface Parser {
  readonly supportedLanguages: string[];
  canParse(language: string): boolean;
  parse(filePath: string, content: string, language: string): ParseResult;
}

export interface StorageAdapter {
  initialize(): Promise<void>;
  close(): Promise<void>;

  upsertFile(file: FileRecord): Promise<void>;
  getFile(path: string): Promise<FileRecord | null>;
  getAllFiles(): Promise<FileRecord[]>;
  deleteFile(path: string): Promise<void>;

  upsertSymbols(symbols: Symbol[]): Promise<void>;
  deleteSymbolsByFile(filePath: string): Promise<void>;
  getSymbols(query: SymbolQuery): Promise<Symbol[]>;
  getSymbolById(id: string): Promise<Symbol | null>;

  upsertImports(imports: ImportRecord[]): Promise<void>;
  deleteImportsByFile(filePath: string): Promise<void>;
  getImports(filePath?: string): Promise<ImportRecord[]>;

  upsertReferences(references: ReferenceRecord[]): Promise<void>;
  deleteReferencesByFile(filePath: string): Promise<void>;
  getReferences(symbolId?: string): Promise<ReferenceRecord[]>;

  upsertChunks(chunks: Chunk[]): Promise<void>;
  deleteChunksByFile(filePath: string): Promise<void>;
  getChunks(filePath?: string): Promise<Chunk[]>;
  getChunkById(id: string): Promise<Chunk | null>;

  upsertGraphNodes(nodes: GraphNode[]): Promise<void>;
  upsertGraphEdges(edges: GraphEdge[]): Promise<void>;
  deleteGraphByFile(filePath: string): Promise<void>;
  getGraphNode(id: string): Promise<GraphNode | null>;
  getGraphNeighbors(query: NeighborQuery): Promise<GraphNeighbor[]>;
  getNodeInDegree(nodeId: string): Promise<number>;
}

export interface Embedder {
  readonly provider: string;
  readonly model: string;
  readonly dimensions: number;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}

export interface VectorStore {
  readonly name: string;
  initialize(): Promise<void>;
  close(): Promise<void>;
  upsert(
    items: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }>,
  ): Promise<void>;
  delete(ids: string[]): Promise<void>;
  search(
    vector: number[],
    limit: number,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>>;
  count(): Promise<number>;
}

export interface Ranker {
  rank(
    candidates: RankingCandidate[],
    context: RankingContext,
    weights?: RankingWeights,
  ): Promise<Array<RankingCandidate & { score: number; scores: Record<string, number> }>>;
}

export interface TokenCounter {
  count(text: string): number;
  countBatch(texts: string[]): number[];
}

export interface Compressor {
  compress(text: string, targetTokens?: number): Promise<string>;
}

export interface CacheAdapter<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface Indexer {
  index(repoPath: string, options?: { force?: boolean }): Promise<IndexResult>;
  getSymbols(query: SymbolQuery): Promise<Symbol[]>;
  getFile(path: string): Promise<FileRecord | null>;
}

export interface SemanticSearch {
  search(query: SearchQuery): Promise<SearchResult[]>;
  indexChunks(chunks: Chunk[]): Promise<void>;
}

export interface GraphService {
  buildForFile(filePath: string): Promise<void>;
  rebuild(): Promise<void>;
  neighbors(query: NeighborQuery): Promise<GraphNeighbor[]>;
  resolveImport(filePath: string, importedName: string): Promise<Symbol | null>;
  getPopularityScores(symbolIds: string[]): Promise<Map<string, number>>;
}

export interface ContextRetriever {
  getContext(request: ContextRequest): Promise<ContextResponse>;
}

export interface Logger {
  debug(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

export type ServiceToken<T> = symbol & { __type?: T };

export interface Container {
  register<T>(token: ServiceToken<T>, factory: () => T): void;
  resolve<T>(token: ServiceToken<T>): T;
  has(token: ServiceToken<unknown>): boolean;
}
