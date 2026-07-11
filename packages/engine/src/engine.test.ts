import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEngine } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRepo = join(__dirname, "../fixtures/sample-repo");

describe("ContextOptimizerEngine", () => {
  it("indexes repo and retrieves auth context", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "ctxopt-"));
    const engine = createEngine({ repoPath: fixtureRepo, dataDir });

    try {
      await engine.initialize();
      const indexResult = await engine.index();
      expect(indexResult.stats.filesIndexed).toBeGreaterThan(0);
      expect(indexResult.stats.symbolsExtracted).toBeGreaterThan(0);

      const symbols = await engine.getSymbols({ name: "refreshToken" });
      expect(symbols.some((s) => s.name === "refreshToken")).toBe(true);

      const searchResults = await engine.search({
        text: "where is auth token refreshed",
        limit: 5,
      });
      expect(searchResults.length).toBeGreaterThan(0);
      expect(
        searchResults.some(
          (r) => r.content.includes("refreshToken") || r.symbolName === "refreshToken",
        ),
      ).toBe(true);

      const context = await engine.getContext({
        task: "fix the login bug related to token refresh",
        currentFile: "src/login.ts",
        cursorPosition: { line: 5, column: 0 },
        openFiles: ["src/login.ts"],
        budget: 4000,
      });

      expect(context.snippets.length).toBeGreaterThan(0);
      expect(context.totalTokens).toBeLessThanOrEqual(4000);
      expect(
        context.snippets.some(
          (s) => s.content.includes("refreshToken") || s.content.includes("AuthService"),
        ),
      ).toBe(true);
    } finally {
      await engine.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("searches after reopening engine in a new process", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "ctxopt-"));
    const engine = createEngine({ repoPath: fixtureRepo, dataDir });

    try {
      await engine.initialize();
      await engine.index();
      await engine.close();

      const reopened = createEngine({ repoPath: fixtureRepo, dataDir });
      await reopened.initialize();
      const searchResults = await reopened.search({
        text: "where is auth token refreshed",
        limit: 5,
      });
      expect(searchResults.length).toBeGreaterThan(0);
      await reopened.close();
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("incrementally re-indexes only changed files", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "ctxopt-"));
    const engine = createEngine({ repoPath: fixtureRepo, dataDir });

    try {
      await engine.initialize();
      const first = await engine.index();
      const second = await engine.index();
      expect(second.stats.filesIndexed).toBe(0);
      expect(second.stats.filesSkipped).toBe(
        first.stats.filesIndexed + first.stats.filesSkipped,
      );
    } finally {
      await engine.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
