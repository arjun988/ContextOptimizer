import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "@contextoptimizer/core";
import { CodeAwareEmbedder } from "./code-aware.js";
import { FakeEmbedder } from "./providers.js";

describe("CodeAwareEmbedder", () => {
  it("ranks auth-related code above unrelated code", async () => {
    const embedder = new CodeAwareEmbedder();
    const result = await embedder.embed({
      texts: [
        "export function refreshToken(user: User) { return auth.refresh(user); }",
        "export function renderDashboard() { return <div>Home</div>; }",
        "where is auth token refreshed",
      ],
    });

    const [authChunk, unrelatedChunk, query] = result.embeddings;
    const authScore = cosineSimilarity(query!, authChunk!);
    const unrelatedScore = cosineSimilarity(query!, unrelatedChunk!);
    expect(authScore).toBeGreaterThan(unrelatedScore);
  });

  it("produces stable normalized vectors", async () => {
    const embedder = new CodeAwareEmbedder();
    const first = await embedder.embed({ texts: ["refreshToken auth service"] });
    const second = await embedder.embed({ texts: ["refreshToken auth service"] });
    expect(first.embeddings[0]).toEqual(second.embeddings[0]);
  });
});

describe("FakeEmbedder", () => {
  it("does not prefer auth code for natural-language queries", async () => {
    const embedder = new FakeEmbedder();
    const result = await embedder.embed({
      texts: [
        "export function refreshToken(user: User) { return auth.refresh(user); }",
        "export function renderDashboard() { return <div>Home</div>; }",
        "where is auth token refreshed",
      ],
    });

    const [authChunk, unrelatedChunk, query] = result.embeddings;
    const authScore = cosineSimilarity(query!, authChunk!);
    const unrelatedScore = cosineSimilarity(query!, unrelatedChunk!);
    expect(Math.abs(authScore - unrelatedScore)).toBeLessThan(0.2);
  });
});
