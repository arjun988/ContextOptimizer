# ContextOptimizer

A production-grade, open-source **AI Context Optimization Engine** — middleware between any AI coding assistant and a repository.

## Features (Phases 0–10)

- **Indexer + Parser** — tree-sitter, incremental indexing, symbol table
- **Dependency Graph** — traversal by distance, cross-file resolution
- **Semantic Search** — hybrid vector + BM25 search
- **Context Retrieval** — multi-factor ranking with token budgets
- **Compression** — dedupe, merge, skeleton summarization with identifier preservation
- **Memory** — project summaries, conventions, conversation history
- **REST API** — Fastify server with OpenAPI docs at `/docs`
- **CLI** — `omni` commands for index, search, context, memory, budget, graph, doctor
- **TypeScript SDK** — in-process and remote client
- **Python SDK** — typed REST client (`pip install contextoptimizer`)
- **Postgres + pgvector** — production storage and persistent vectors
- **MCP Server** — 8 tools for Cursor, Claude Code, Kiro
- **Observability** — Prometheus metrics, structured logging
- **Benchmarks** — compare vs naive retrieval and simple RAG
- **Docs** — Docusaurus site with architecture, plugin guides, deployment guide

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

With Postgres + auth:

```bash
docker compose up -d
# API at http://localhost:3100, OpenAPI docs at /docs
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |
| `/doctor` | GET | Diagnostics |
| `/docs` | GET | OpenAPI UI |
| `/index` | POST | Index repository |
| `/search` | POST | Semantic search |
| `/context` | POST | Get ranked context |
| `/compress` | POST | Compress prompt |
| `/budget` | POST | Fit snippets in budget |
| `/symbols` | POST | Query symbols |
| `/graph` | POST | Graph neighbors |
| `/memory` | POST | Remember / recall |

Set `API_TOKEN` for Bearer auth. See [deployment guide](apps/docs/docs/guides/deployment.md).

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

## Python SDK

```python
from contextoptimizer import Client

client = Client("http://localhost:3100", api_key="your-token")
client.index()
results = client.search("auth token refresh")
context = client.get_context(task="fix login bug", budget=8000)
```

## Docker Compose

```bash
docker compose up -d
# Postgres + pgvector on :5432, API on :3100
```

## Documentation

```bash
pnpm --filter @contextoptimizer/docs start
```

Or read the docs in `apps/docs/docs/` — architecture, plugin guides, SDK guides, deployment.

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
| `@contextoptimizer/storage-postgres` | Postgres storage adapter |
| `contextoptimizer` (PyPI) | Python SDK |
| `@contextoptimizer/api` | REST API server |
| `@contextoptimizer/cli` | `omni` CLI |
| `@contextoptimizer/mcp` | MCP server |
| `@contextoptimizer/docs` | Docusaurus documentation site |

## Roadmap

See [ROADMAP.md](./ROADMAP.md).

## License

MIT
