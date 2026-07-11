import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mcpEntry = join(__dirname, "../dist/index.js");
const repoPath = resolve(__dirname, "../../../packages/engine/fixtures/sample-repo");

async function withMcpClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [mcpEntry],
    env: { ...process.env, REPO_PATH: repoPath },
  });

  const client = new Client({ name: "mcp-test", version: "1.0.0" });
  await client.connect(transport);

  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

describe("ContextOptimizer MCP server", () => {
  it("lists all tools including index_repository and doctor", async () => {
    await withMcpClient(async (client) => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("index_repository");
      expect(names).toContain("doctor");
      expect(names).toContain("retrieve_context");
      expect(names).toContain("search_symbols");
      expect(tools.length).toBeGreaterThanOrEqual(10);
    });
  });

  it("indexes repo and retrieves context end-to-end", async () => {
    await withMcpClient(async (client) => {
      const indexResult = await client.callTool({
        name: "index_repository",
        arguments: { force: true },
      });
      const indexText =
        (indexResult.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(indexText).toContain("filesIndexed");

      const doctorResult = await client.callTool({ name: "doctor", arguments: {} });
      const doctorText =
        (doctorResult.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      expect(doctorText).toContain('"healthy": true');

      const contextResult = await client.callTool({
        name: "retrieve_context",
        arguments: { task: "fix login bug related to token refresh" },
      });
      const contextText =
        (contextResult.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
      const context = JSON.parse(contextText) as { snippets: unknown[]; totalTokens: number };
      expect(context.snippets.length).toBeGreaterThan(0);
      expect(context.totalTokens).toBeGreaterThan(0);
    });
  }, 60_000);
});
