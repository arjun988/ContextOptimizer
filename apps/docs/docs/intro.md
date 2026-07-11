---
id: intro
title: Introduction
sidebar_position: 1
---

# ContextOptimizer

ContextOptimizer is an open-source AI Context Optimization Engine. It indexes codebases, builds dependency graphs, runs hybrid semantic search, ranks snippets, and fits results into token budgets.

## Quick start

```bash
pnpm install
pnpm build
pnpm omni index
pnpm omni context "fix the login bug" --budget 8000
```

## Features

- **Incremental indexing** with tree-sitter parsing
- **Hybrid search** — BM25 + vector similarity
- **Graph expansion** — follow imports, calls, references
- **Multi-factor ranking** — semantic, graph distance, popularity, recency
- **Compression pipeline** — dedupe, merge, skeleton, summarize
- **Memory store** — project summaries and retrieval history
- **REST API, CLI, MCP server, TypeScript & Python SDKs**
