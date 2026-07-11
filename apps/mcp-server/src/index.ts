#!/usr/bin/env node
import { resolve } from "node:path";
import { createEmbedderFromEnv } from "@contextoptimizer/embeddings";
import { createEngine } from "@contextoptimizer/engine";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const repoPath = resolve(process.env.REPO_PATH ?? process.cwd());
const engine = createEngine({
  repoPath,
  embedder: createEmbedderFromEnv(),
  defaultBudget: process.env.DEFAULT_BUDGET ? Number(process.env.DEFAULT_BUDGET) : undefined,
});
await engine.initialize();

const server = new McpServer({
  name: "contextoptimizer",
  version: "0.1.0",
});

server.tool(
  "index_repository",
  "Index or re-index the repository. Run this before other tools on a new project.",
  { force: z.boolean().optional() },
  async ({ force }) => {
    const result = await engine.index({ force });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool("doctor", "Check index health and readiness", {}, async () => {
  const result = await engine.doctor();
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.tool(
  "search_symbols",
  "Search for symbols in the indexed codebase by name or semantic query",
  { query: z.string(), limit: z.number().optional() },
  async ({ query, limit }) => {
    const symbols = await engine.getSymbols({ name: query, limit: limit ?? 20 });
    const search = await engine.search({ text: query, limit: limit ?? 10 });
    return {
      content: [{ type: "text", text: JSON.stringify({ symbols, search }, null, 2) }],
    };
  },
);

server.tool(
  "find_dependencies",
  "Find dependencies of a symbol or file within N hops",
  { nodeId: z.string(), depth: z.number().optional() },
  async ({ nodeId, depth }) => {
    const neighbors = await engine.neighbors(nodeId, depth ?? 2);
    return { content: [{ type: "text", text: JSON.stringify(neighbors, null, 2) }] };
  },
);

server.tool(
  "retrieve_context",
  "Retrieve ranked, budget-aware context for a coding task",
  {
    task: z.string(),
    currentFile: z.string().optional(),
    budget: z.number().optional(),
  },
  async ({ task, currentFile, budget }) => {
    const context = await engine.getContext({ task, currentFile, budget });
    return { content: [{ type: "text", text: JSON.stringify(context, null, 2) }] };
  },
);

server.tool("project_summary", "Get the stored project summary from memory", {}, async () => {
  const summary = await engine.getProjectSummary();
  const files = await engine.getSymbols({ limit: 5 });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ summary, topSymbols: files }, null, 2),
      },
    ],
  };
});

server.tool(
  "search_docs",
  "Search documentation and markdown files semantically",
  { query: z.string(), limit: z.number().optional() },
  async ({ query, limit }) => {
    const results = await engine.search({ text: query, limit: limit ?? 10 });
    const docs = results.filter((r) => r.filePath.endsWith(".md"));
    return { content: [{ type: "text", text: JSON.stringify(docs, null, 2) }] };
  },
);

server.tool(
  "conversation_summary",
  "Store or recall conversation summaries",
  {
    action: z.enum(["remember", "recall"]),
    content: z.string().optional(),
    key: z.string().optional(),
  },
  async ({ action, content, key }) => {
    if (action === "remember" && content) {
      const entry = await engine.remember({
        category: "conversation",
        key: key ?? "latest",
        content,
      });
      return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
    }
    const entries = await engine.recall({ category: "conversation", key, limit: 5 });
    return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
  },
);

server.tool(
  "budget_context",
  "Retrieve context and fit within a token budget",
  { task: z.string(), budget: z.number() },
  async ({ task, budget }) => {
    const context = await engine.getContext({ task, budget });
    const budgeted = await engine.budget({ snippets: context.snippets, budget });
    return { content: [{ type: "text", text: JSON.stringify(budgeted, null, 2) }] };
  },
);

server.tool(
  "compress_prompt",
  "Compress text while preserving identifiers",
  { text: z.string(), targetTokens: z.number().optional() },
  async ({ text, targetTokens }) => {
    const result = await engine.compress({ text, targetTokens });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", async () => {
  await engine.close();
  process.exit(0);
});
