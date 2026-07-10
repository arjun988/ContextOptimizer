import type { RankingCandidate, RankingContext } from "@contextoptimizer/core";
import { describe, expect, it } from "vitest";
import { MultiFactorRanker } from "../src/multi-factor-ranker.js";

describe("MultiFactorRanker", () => {
  const ranker = new MultiFactorRanker();

  it("ranks open files higher", async () => {
    const candidates: RankingCandidate[] = [
      {
        id: "a",
        chunkId: "a",
        filePath: "src/open.ts",
        content: "open file",
        startLine: 0,
        endLine: 1,
        kind: "code",
      },
      {
        id: "b",
        chunkId: "b",
        filePath: "src/other.ts",
        content: "other file",
        startLine: 0,
        endLine: 1,
        kind: "code",
      },
    ];

    const context: RankingContext = {
      request: { task: "test", openFiles: ["src/open.ts"] },
      semanticScores: new Map([
        ["a", 0.5],
        ["b", 0.5],
      ]),
      graphDistances: new Map(),
      popularityScores: new Map(),
      fileIndexedAt: new Map(),
    };

    const ranked = await ranker.rank(candidates, context);
    expect(ranked[0]?.filePath).toBe("src/open.ts");
  });

  it("ranks cursor proximity higher", async () => {
    const candidates: RankingCandidate[] = [
      {
        id: "near",
        chunkId: "near",
        filePath: "src/main.ts",
        content: "near cursor",
        startLine: 10,
        endLine: 12,
        kind: "code",
      },
      {
        id: "far",
        chunkId: "far",
        filePath: "src/main.ts",
        content: "far from cursor",
        startLine: 200,
        endLine: 210,
        kind: "code",
      },
    ];

    const context: RankingContext = {
      request: {
        task: "test",
        currentFile: "src/main.ts",
        cursorPosition: { line: 11, column: 0 },
      },
      semanticScores: new Map([
        ["near", 0.5],
        ["far", 0.5],
      ]),
      graphDistances: new Map(),
      popularityScores: new Map(),
      fileIndexedAt: new Map(),
    };

    const ranked = await ranker.rank(candidates, context);
    expect(ranked[0]?.id).toBe("near");
  });
});
