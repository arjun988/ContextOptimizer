import { createTokenCounter } from "@contextoptimizer/tokenizer";
import { describe, expect, it } from "vitest";
import { createCompressionPipeline, extractIdentifiers } from "./index.js";

describe("CompressionPipeline", () => {
  const counter = createTokenCounter();
  const pipeline = createCompressionPipeline({ tokenCounter: counter });

  it("reduces tokens while preserving identifiers", async () => {
    const text = `
export class AuthService {
  async refreshToken(): Promise<string> {
    const response = await fetch("/api/auth/refresh");
    const data = await response.json();
    return data.token;
  }
}

export class AuthService {
  async refreshToken(): Promise<string> {
    const response = await fetch("/api/auth/refresh");
    return response.token;
  }
}
`;
    const result = await pipeline.compress({ text });
    expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    expect(result.compressed).toContain("AuthService");
    expect(result.compressed).toContain("refreshToken");
  });

  it("extracts identifiers from code", () => {
    const ids = extractIdentifiers("class UserService { getUser() {} }");
    expect(ids).toContain("UserService");
    expect(ids).toContain("getUser");
  });
});
