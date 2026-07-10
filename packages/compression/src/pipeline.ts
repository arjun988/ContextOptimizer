import type {
  CompressRequest,
  CompressionPipeline,
  CompressionResult,
  CompressionStageResult,
  Compressor,
} from "@contextoptimizer/core";
import type { TokenCounter } from "@contextoptimizer/core";
import {
  CodeSkeletonCompressor,
  ConversationSummarizer,
  DedupeCompressor,
  MergeChunksCompressor,
  ensureIdentifiersPreserved,
  extractIdentifiers,
} from "./compressors.js";

export interface PipelineOptions {
  tokenCounter: TokenCounter;
  stages?: Compressor[];
}

export class DefaultCompressionPipeline implements CompressionPipeline {
  private stages: Compressor[];

  constructor(private readonly options: PipelineOptions) {
    this.stages = options.stages ?? [
      new DedupeCompressor(),
      new MergeChunksCompressor(),
      new CodeSkeletonCompressor(),
      new ConversationSummarizer(),
    ];
  }

  async compress(request: CompressRequest): Promise<CompressionResult> {
    const start = Date.now();
    const originalTokens = this.options.tokenCounter.count(request.text);
    const preservedIdentifiers = extractIdentifiers(request.text);
    const stageResults: CompressionStageResult[] = [];

    let current = request.text;
    for (const stage of this.stages) {
      const stageStart = Date.now();
      const tokensIn = this.options.tokenCounter.count(current);
      current = await stage.compress(current, request.targetTokens);
      const tokensOut = this.options.tokenCounter.count(current);
      stageResults.push({
        stage: stage.name,
        tokensIn,
        tokensOut,
        durationMs: Date.now() - stageStart,
      });

      if (request.targetTokens && tokensOut <= request.targetTokens) break;
    }

    current = ensureIdentifiersPreserved(request.text, current);
    const compressedTokens = this.options.tokenCounter.count(current);
    const savedTokens = Math.max(0, originalTokens - compressedTokens);

    return {
      compressed: current,
      originalTokens,
      compressedTokens,
      savedTokens,
      savedPercent: originalTokens > 0 ? (savedTokens / originalTokens) * 100 : 0,
      stages: stageResults,
      preservedIdentifiers,
    };
  }
}

export function createCompressionPipeline(options: PipelineOptions): DefaultCompressionPipeline {
  return new DefaultCompressionPipeline(options);
}

export * from "./compressors.js";
