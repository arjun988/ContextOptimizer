import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const REPO = {
  type: "git",
  url: "git+https://github.com/contextoptimizer/contextoptimizer.git",
};

const PUBLISH_CONFIG = { access: "public" };
const ENGINES = { node: ">=22" };
const LICENSE = "MIT";

const PACKAGES = [
  {
    path: "packages/cache/package.json",
    description: "Caching utilities for ContextOptimizer",
  },
  {
    path: "packages/compression/package.json",
    description: "Prompt compression pipeline for ContextOptimizer",
  },
  {
    path: "packages/core/package.json",
    description: "Core types, interfaces, and schemas for ContextOptimizer",
  },
  {
    path: "packages/embeddings/package.json",
    description: "Embedding providers for ContextOptimizer",
  },
  {
    path: "packages/engine/package.json",
    description: "High-level ContextOptimizer engine facade",
  },
  {
    path: "packages/graph/package.json",
    description: "Dependency graph service for ContextOptimizer",
  },
  {
    path: "packages/indexer/package.json",
    description: "Incremental codebase indexer for ContextOptimizer",
  },
  {
    path: "packages/memory/package.json",
    description: "Persistent project memory for ContextOptimizer",
  },
  {
    path: "packages/observability/package.json",
    description: "Metrics and logging for ContextOptimizer",
  },
  {
    path: "packages/parser/package.json",
    description: "tree-sitter parser for ContextOptimizer",
  },
  {
    path: "packages/ranking/package.json",
    description: "Multi-factor ranker for ContextOptimizer",
  },
  {
    path: "packages/retrieval/package.json",
    description: "Hybrid search and context retrieval for ContextOptimizer",
  },
  {
    path: "packages/sdk-ts/package.json",
    description: "TypeScript SDK for ContextOptimizer",
  },
  {
    path: "packages/storage/package.json",
    description: "SQLite storage adapter for ContextOptimizer",
  },
  {
    path: "packages/storage-postgres/package.json",
    description: "Postgres storage adapter for ContextOptimizer",
  },
  {
    path: "packages/tokenizer/package.json",
    description: "Token counting and budget management for ContextOptimizer",
  },
  {
    path: "packages/vector-store/package.json",
    description: "Vector store adapters for ContextOptimizer",
  },
  {
    path: "apps/mcp-server/package.json",
    description: "MCP server for ContextOptimizer — primary user interface",
  },
  {
    path: "apps/cli/package.json",
    description: "CLI (omni) for ContextOptimizer",
  },
  {
    path: "apps/api/package.json",
    description: "REST API server for ContextOptimizer",
  },
];

for (const entry of PACKAGES) {
  const filePath = join(root, entry.path);
  const pkg = JSON.parse(readFileSync(filePath, "utf8"));

  pkg.description = entry.description;
  pkg.license = LICENSE;
  pkg.repository = { ...REPO, directory: entry.path.replace("/package.json", "") };
  pkg.publishConfig = PUBLISH_CONFIG;
  pkg.files = ["dist"];
  pkg.engines = ENGINES;

  writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`Updated ${entry.path}`);
}
