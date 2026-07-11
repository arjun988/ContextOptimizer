# ContextOptimizer

A production-grade, open-source **AI Context Optimization Engine** — middleware between any AI coding assistant and a repository.

## Features (Phases 0–8)

- **Indexer + Parser** — tree-sitter, incremental indexing, symbol table
- **Dependency Graph** — traversal by distance, cross-file resolution
- **Semantic Search** — hybrid vector + BM25 search
- **Context Retrieval** — multi-factor ranking with token budgets
- **Compression** — dedupe, merge, skeleton summarization with identifier preservation
- **Memory** — project summaries, conventions, conversation history
- **REST API** — Fastify server with OpenAPI-ready routes
- **CLI** — `omni` commands for index, search, context, memory, budget, graph, doctor
- **TypeScript SDK** — in-process and remote client
- **MCP Server** — 8 tools for Cursor, Claude Code, Kiro
- **Observability** — Prometheus metrics, structured logging
- **Benchmarks** — compare vs naive retrieval and simple RAG

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## CLI

```bash
# Build once, then run from the repo root (indexes the current directory)
pnpm build
pnpm omni index

# Or call the linked binary directly
pnpm exec omni index

# Search semantically
pnpm omni search "where is auth token refreshed"

# Get budgeted context
pnpm omni context "fix the login bug" --budget 8000

# Health check
pnpm omni doctor
```

## REST API

```bash
REPO_PATH=/path/to/repo pnpm --filter @contextoptimizer/api start
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |
| `/index` | POST | Index repository |
| `/search` | POST | Semantic search |
| `/context` | POST | Get ranked context |
| `/compress` | POST | Compress prompt |
| `/budget` | POST | Fit snippets in budget |
| `/symbols` | POST | Query symbols |
| `/graph` | POST | Graph neighbors |
| `/memory` | POST | Remember / recall |

## TypeScript SDK

```typescript
import { createClient } from "@contextoptimizer/sdk-ts";

// In-process
const client = createClient({ repoPath: "/path/to/repo" });
await client.initialize();
const context = await client.getContext({ task: "fix login bug", budget: 8000 });

// Remote
const remote = createClient({ baseUrl: "http://localhost:3100" });
const results = await remote.search({ text: "auth token" });
```

## MCP Server (Cursor / Claude Code)

Add to your MCP config:

```json
{
  "mcpServers": {
    "contextoptimizer": {
      "command": "node",
      "args": ["path/to/apps/mcp-server/dist/index.js"],
      "env": { "REPO_PATH": "/path/to/your/repo" }
    }
  }
}
```

Tools: `search_symbols`, `find_dependencies`, `retrieve_context`, `project_summary`, `search_docs`, `conversation_summary`, `budget_context`, `compress_prompt`

## Benchmarks

```bash
pnpm --filter @contextoptimizer/benchmarks bench
```

## Packages

| Package | Description |
|---------|-------------|
| `@contextoptimizer/core` | Types, interfaces, schemas |
| `@contextoptimizer/engine` | High-level facade |
| `@contextoptimizer/compression` | Prompt compression pipeline |
| `@contextoptimizer/memory` | Persistent project memory |
| `@contextoptimizer/sdk-ts` | TypeScript SDK |
| `@contextoptimizer/api` | REST API server |
| `@contextoptimizer/cli` | `omni` CLI |
| `@contextoptimizer/mcp` | MCP server |

## Roadmap

See [ROADMAP.md](./ROADMAP.md).

## License

MIT
