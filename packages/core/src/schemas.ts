import { z } from "zod";

export const PositionSchema = z.object({
  line: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
});

export const ContextRequestSchema = z.object({
  task: z.string().min(1),
  currentFile: z.string().optional(),
  cursorPosition: PositionSchema.optional(),
  conversationSummary: z.string().optional(),
  openFiles: z.array(z.string()).optional(),
  recentEdits: z.array(z.string()).optional(),
  gitDiff: z.string().optional(),
  budget: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});

export const SymbolQuerySchema = z.object({
  name: z.string().optional(),
  kind: z.string().optional(),
  filePath: z.string().optional(),
  language: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export const SearchQuerySchema = z.object({
  text: z.string().min(1),
  limit: z.number().int().positive().optional(),
  filePath: z.string().optional(),
  language: z.string().optional(),
  kinds: z.array(z.string()).optional(),
});

export const NeighborQuerySchema = z.object({
  nodeId: z.string().min(1),
  depth: z.number().int().positive().optional(),
  edgeKinds: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
});

export const RankingWeightsSchema = z.object({
  semanticSimilarity: z.number().min(0).max(1),
  dependencyDistance: z.number().min(0).max(1),
  openFiles: z.number().min(0).max(1),
  gitDiffOverlap: z.number().min(0).max(1),
  recentEdits: z.number().min(0).max(1),
  cursorProximity: z.number().min(0).max(1),
  recency: z.number().min(0).max(1),
  popularity: z.number().min(0).max(1),
});

export const MemoryEntrySchema = z.object({
  category: z.enum([
    "project_summary",
    "architecture",
    "conventions",
    "frequent_symbols",
    "conversation",
    "previous_retrieval",
  ]),
  key: z.string().min(1),
  content: z.string().min(1),
  sourceHash: z.string().optional(),
});

export const MemoryQuerySchema = z.object({
  category: z.string().optional(),
  key: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

export const CompressRequestSchema = z.object({
  text: z.string().min(1),
  targetTokens: z.number().int().positive().optional(),
});

export const BudgetRequestSchema = z.object({
  budget: z.number().int().positive(),
});
