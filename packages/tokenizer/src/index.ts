import type { TokenCounter } from "@contextoptimizer/core";
import { type Tiktoken, type TiktokenEncoding, getEncoding } from "js-tiktoken";

export type ModelFamily = "gpt-4" | "gpt-3.5" | "claude" | "generic";

const ENCODING_MAP: Record<ModelFamily, TiktokenEncoding> = {
  "gpt-4": "cl100k_base",
  "gpt-3.5": "cl100k_base",
  claude: "cl100k_base",
  generic: "cl100k_base",
};

export class TiktokenCounter implements TokenCounter {
  private encoding: Tiktoken;

  constructor(modelFamily: ModelFamily = "generic") {
    this.encoding = getEncoding(ENCODING_MAP[modelFamily]);
  }

  count(text: string): number {
    return this.encoding.encode(text).length;
  }

  countBatch(texts: string[]): number[] {
    return texts.map((t) => this.count(t));
  }
}

export class BudgetManager {
  constructor(
    private readonly counter: TokenCounter,
    private readonly defaultBudget?: number,
  ) {}

  getBudget(requested?: number): number | undefined {
    return requested ?? this.defaultBudget;
  }

  fillWithinBudget<T extends { content: string; tokenCount?: number }>(
    items: T[],
    budget: number,
  ): { selected: T[]; totalTokens: number } {
    const selected: T[] = [];
    let totalTokens = 0;

    for (const item of items) {
      const tokens = item.tokenCount ?? this.counter.count(item.content);
      if (totalTokens + tokens > budget) break;
      selected.push({ ...item, tokenCount: tokens } as T);
      totalTokens += tokens;
    }

    return { selected, totalTokens };
  }

  selectAdaptive<T extends { content: string; score: number; tokenCount?: number }>(
    items: T[],
    options: { totalChunks: number; maxBudget?: number },
  ): { selected: T[]; totalTokens: number } {
    if (items.length === 0) {
      return { selected: [], totalTokens: 0 };
    }

    const repoCap =
      options.totalChunks <= 30
        ? 1500
        : options.totalChunks <= 200
          ? 4000
          : options.totalChunks <= 1000
            ? 8000
            : 12000;
    const maxSnippets =
      options.totalChunks <= 30
        ? 5
        : options.totalChunks <= 200
          ? 12
          : options.totalChunks <= 1000
            ? 20
            : 30;
    const effectiveMax = Math.min(options.maxBudget ?? repoCap, repoCap);
    const topScore = items[0]?.score ?? 0;
    const selected: T[] = [];
    let totalTokens = 0;

    for (const item of items) {
      if (selected.length >= maxSnippets) break;

      const tokens = item.tokenCount ?? this.counter.count(item.content);

      if (selected.length > 0 && topScore > 0) {
        const relativeScore = item.score / topScore;
        if (relativeScore < 0.35 && selected.length >= 3) break;
        if (relativeScore < 0.2) break;
      }

      if (totalTokens + tokens > effectiveMax) break;

      selected.push({ ...item, tokenCount: tokens } as T);
      totalTokens += tokens;
    }

    if (selected.length === 0) {
      const first = items[0]!;
      const tokens = first.tokenCount ?? this.counter.count(first.content);
      return { selected: [{ ...first, tokenCount: tokens } as T], totalTokens: tokens };
    }

    return { selected, totalTokens };
  }
}

export function createTokenCounter(modelFamily?: ModelFamily): TiktokenCounter {
  return new TiktokenCounter(modelFamily);
}
