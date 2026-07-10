import { describe, expect, it } from "vitest";
import { createParser } from "../src/index.js";

const parser = createParser();

describe("TreeSitterParser", () => {
  it("extracts TypeScript symbols", () => {
    const content = `
export class UserService {
  async getUser(id: string): Promise<User> {
    return { id };
  }
}

export function createUser(name: string) {
  return { name };
}
`;
    const result = parser.parse("src/user.ts", content, "typescript");
    expect(result.symbols.some((s) => s.name === "UserService" && s.kind === "class")).toBe(true);
    expect(result.symbols.some((s) => s.name === "createUser" && s.kind === "function")).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it("extracts Python symbols", () => {
    const content = `
class DataProcessor:
    def process(self, data):
        return data

def load_data(path):
    return path
`;
    const result = parser.parse("processor.py", content, "python");
    expect(result.symbols.some((s) => s.name === "DataProcessor")).toBe(true);
    expect(result.symbols.some((s) => s.name === "load_data")).toBe(true);
  });

  it("extracts JavaScript imports", () => {
    const content = `
import { AuthService } from './auth.js';

export function login() {
  const auth = new AuthService();
  return auth.refreshToken();
}
`;
    const result = parser.parse("login.js", content, "javascript");
    expect(result.imports.length).toBeGreaterThan(0);
    expect(result.imports[0]?.source).toContain("auth");
  });
});
