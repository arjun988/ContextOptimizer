export type SymbolKind =
  | "class"
  | "function"
  | "method"
  | "interface"
  | "type"
  | "variable"
  | "import"
  | "export"
  | "namespace"
  | "enum"
  | "field"
  | "constant"
  | "struct"
  | "module";

export type SupportedLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "c"
  | "cpp";

export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Symbol {
  id: string;
  name: string;
  kind: SymbolKind;
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  signature?: string;
  documentation?: string;
  parentId?: string;
  language: SupportedLanguage;
  exported?: boolean;
}

export interface FileRecord {
  id: string;
  path: string;
  hash: string;
  size: number;
  language: SupportedLanguage | "unknown";
  mtime: number;
  indexedAt: number;
}

export interface ImportRecord {
  id: string;
  fileId: string;
  filePath: string;
  source: string;
  importedNames: string[];
  isDefault: boolean;
  line: number;
}

export interface ReferenceRecord {
  id: string;
  fromSymbolId: string;
  toSymbolId?: string;
  toName: string;
  kind: "call" | "import" | "type" | "read" | "write";
  filePath: string;
  line: number;
}

export interface Chunk {
  id: string;
  symbolId?: string;
  filePath: string;
  content: string;
  hash: string;
  language: SupportedLanguage | "unknown";
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  symbolName?: string;
  symbolKind?: SymbolKind;
  signature?: string;
  enclosingClass?: string;
  startLine: number;
  endLine: number;
}

export interface ParseResult {
  symbols: Symbol[];
  imports: Omit<ImportRecord, "id" | "fileId">[];
  references: Omit<ReferenceRecord, "id">[];
  chunks: Chunk[];
}

export interface SymbolQuery {
  name?: string;
  kind?: SymbolKind;
  filePath?: string;
  language?: SupportedLanguage;
  limit?: number;
  offset?: number;
}

export interface SearchQuery {
  text: string;
  limit?: number;
  filePath?: string;
  language?: SupportedLanguage;
  kinds?: SymbolKind[];
}

export interface SearchResult {
  chunkId: string;
  symbolId?: string;
  filePath: string;
  content: string;
  score: number;
  symbolName?: string;
  metadata: ChunkMetadata;
}

export interface ContextRequest {
  task: string;
  currentFile?: string;
  cursorPosition?: Position;
  conversationSummary?: string;
  openFiles?: string[];
  recentEdits?: string[];
  gitDiff?: string;
  budget?: number;
  limit?: number;
}

export interface RankedSnippet {
  id: string;
  content: string;
  filePath: string;
  symbolId?: string;
  score: number;
  scores: Record<string, number>;
  tokenCount: number;
  kind: "code" | "test" | "doc";
  startLine: number;
  endLine: number;
}

export interface ContextResponse {
  snippets: RankedSnippet[];
  totalTokens: number;
  metadata: {
    candidatesConsidered: number;
    cacheHit: boolean;
    latencyMs: number;
  };
}

export type GraphNodeKind = "file" | "symbol";

export type GraphEdgeKind = "imports" | "exports" | "calls" | "references" | "contains";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  name: string;
  filePath?: string;
  symbolKind?: SymbolKind;
}

export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  kind: GraphEdgeKind;
  weight?: number;
}

export interface GraphNeighbor {
  node: GraphNode;
  edge: GraphEdge;
  distance: number;
}

export interface NeighborQuery {
  nodeId: string;
  depth?: number;
  edgeKinds?: GraphEdgeKind[];
  limit?: number;
}

export interface IndexStats {
  filesIndexed: number;
  filesSkipped: number;
  filesRemoved: number;
  symbolsExtracted: number;
  durationMs: number;
}

export interface IndexResult {
  stats: IndexStats;
  repoPath: string;
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  provider: string;
  dimensions: number;
}

export interface RankingWeights {
  semanticSimilarity: number;
  dependencyDistance: number;
  openFiles: number;
  gitDiffOverlap: number;
  recentEdits: number;
  cursorProximity: number;
  recency: number;
  popularity: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  semanticSimilarity: 0.35,
  dependencyDistance: 0.15,
  openFiles: 0.1,
  gitDiffOverlap: 0.1,
  recentEdits: 0.08,
  cursorProximity: 0.12,
  recency: 0.05,
  popularity: 0.05,
};

export interface RankingContext {
  request: ContextRequest;
  semanticScores: Map<string, number>;
  graphDistances: Map<string, number>;
  popularityScores: Map<string, number>;
  fileIndexedAt: Map<string, number>;
}

export interface RankingCandidate {
  id: string;
  chunkId: string;
  symbolId?: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  kind: "code" | "test" | "doc";
}

export type MemoryCategory =
  | "project_summary"
  | "architecture"
  | "conventions"
  | "frequent_symbols"
  | "conversation"
  | "previous_retrieval";

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  key: string;
  content: string;
  sourceHash?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryQuery {
  category?: MemoryCategory;
  key?: string;
  limit?: number;
}

export interface CompressionStageResult {
  stage: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
}

export interface CompressionResult {
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  savedTokens: number;
  savedPercent: number;
  stages: CompressionStageResult[];
  preservedIdentifiers: string[];
}

export interface CompressRequest {
  text: string;
  targetTokens?: number;
  snippets?: RankedSnippet[];
}

export interface BudgetRequest {
  snippets: RankedSnippet[];
  budget: number;
}

export interface BudgetResponse {
  snippets: RankedSnippet[];
  totalTokens: number;
  budget: number;
  utilization: number;
}
