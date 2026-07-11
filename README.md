# ContextOptimizer

A production-grade, open-source **AI Context Optimization Engine** — middleware between any AI coding assistant and a repository. It indexes your codebase, ranks the most relevant snippets, and fits them into a token budget so agents get better context with fewer tokens.

## What it does

| Capability | Description |
|------------|-------------|
| **Incremental indexing** | tree-sitter parsing, symbol extraction, hash-based re-indexing |
| **Dependency graph** | Cross-file imports, calls, references with distance traversal |
| **Hybrid search** | BM25 keyword + vector similarity |
| **Context retrieval** | Multi-factor ranking (semantic, graph, popularity, recency) |
| **Token budgeting** | Fit snippets into a configurable token limit |
| **Compression** | Dedupe, merge, skeleton summarization with identifier preservation |
| **Memory** | Project summaries, architecture notes, conversation history |
| **Observability** | Prometheus metrics, structured logging |

## Interfaces

| Interface | Use case |
|-----------|----------|
| **CLI** (`omni`) | Local dev, scripts, CI |
| **REST API** | Team-shared index server, remote clients |
| **MCP Server** | Cursor, Claude Code, Kiro, any MCP client |
| **TypeScript SDK** | In-process or HTTP client in Node apps |
| **Python SDK** | Scripts, notebooks, backend integrations |

---

## Prerequisites

- **Node.js** 22+
- **pnpm** 9+ (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- **Python** 3.10+ (optional, for Python SDK)
- **Docker** (optional, for Postgres + API via compose)

---

## Installation

Clone and build from source:

```bash
git clone https://github.com/contextoptimizer/contextoptimizer.git
cd contextoptimizer
pnpm install
pnpm build
```

The CLI (`omni`) is linked automatically after install. Verify:

```bash
pnpm omni doctor
```

Index data is stored in `.contextoptimizer/` in the repo root (SQLite by default).

---

## Quick start

```bash
# 1. Index the current directory
pnpm omni index

# 2. Search for relevant code
pnpm omni search "auth token refresh"

# 3. Get ranked, budgeted context for a task
pnpm omni context "fix the login bug" --budget 8000

# 4. Health check
pnpm omni doctor
```

On a second `index` run, `filesIndexed: 0` with high `filesSkipped` is normal — incremental indexing skips unchanged files.

Force a full re-index:

```bash
pnpm omni index --force
```

Index a different repo:

```bash
# PowerShell
$env:REPO_PATH="C:\path\to\repo"; pnpm omni index

# bash
REPO_PATH=/path/to/repo pnpm omni index
```

---

## CLI (`omni`)

All commands run from the repo root (or set `REPO_PATH`).

| Command | Description |
|---------|-------------|
| `omni index [--force]` | Index repository |
| `omni search <query> [-l N]` | Hybrid semantic search |
| `omni context <task> [-b budget] [-f file]` | Ranked context within token budget |
| `omni memory remember -t "..." [-c category] [-k key]` | Store a memory entry |
| `omni memory recall [-c category] [-k key]` | Recall memory entries |
| `omni budget -b <tokens>` | Fit snippets within a budget |
| `omni graph <nodeId> [-d depth]` | Graph neighbors for a symbol/file |
| `omni doctor` | Health diagnostics |

**Examples**

```bash
pnpm omni search "repo indexer" -l 5
pnpm omni context "how does indexing work" --budget 4000 --file packages/indexer/src/repo-indexer.ts
pnpm omni memory remember -c architecture -k auth -t "Uses JWT refresh tokens"
pnpm omni graph "sym:abc123" -d 2
```

**Tips:** The default embedder is hash-based (`FakeEmbedder`). Code-oriented queries (`repo indexer`, `refreshToken`) work best. For real semantic search, configure OpenAI/Voyage via the API (see [Environment variables](#environment-variables)).

---

## REST API

Start the server:

```bash
# Local (SQLite)
pnpm --filter @contextoptimizer/api start

# Or with env vars
REPO_PATH=. PORT=3100 pnpm --filter @contextoptimizer/api start
```

Production stack (Postgres + pgvector + auth):

```bash
docker compose up -d
# API → http://localhost:3100
# OpenAPI UI → http://localhost:3100/docs
```

### Endpoints

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

When `API_TOKEN` is set, send `Authorization: Bearer <token>` on all routes except `/health`, `/metrics`, and `/docs`.

**Example**

```bash
curl -X POST http://localhost:3100/search \
  -H "Content-Type: application/json" \
  -d '{"text": "auth token refresh", "limit": 5}'
```

---

## MCP Server (Cursor / Claude Code / Kiro)

The MCP server exposes 8 tools over stdio so AI assistants can index, search, and retrieve context directly.

### 1. Build

```bash
pnpm --filter @contextoptimizer/mcp build
```

### 2. Configure your MCP client

**Cursor** — add to `.cursor/mcp.json` (or global MCP settings):

```json
{
  "mcpServers": {
    "contextoptimizer": {
      "command": "node",
      "args": ["C:/Users/You/Desktop/ContextOptimizer/apps/mcp-server/dist/index.js"],
      "env": {
        "REPO_PATH": "C:/Users/You/path/to/your/repo"
      }
    }
  }
}
```

Use absolute paths. On Windows, forward slashes work in JSON.

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "contextoptimizer": {
      "command": "node",
      "args": ["/absolute/path/to/ContextOptimizer/apps/mcp-server/dist/index.js"],
      "env": { "REPO_PATH": "/absolute/path/to/your/repo" }
    }
  }
}
```

### 3. Index first

Run `pnpm omni index` in the target repo (or use the API) before MCP tools return useful results.

### MCP tools

| Tool | Description |
|------|-------------|
| `search_symbols` | Search symbols by name + semantic query |
| `find_dependencies` | Graph neighbors within N hops |
| `retrieve_context` | Ranked, budget-aware context for a task |
| `project_summary` | Stored project summary + top symbols |
| `search_docs` | Semantic search filtered to `.md` files |
| `conversation_summary` | Remember or recall conversation summaries |
| `budget_context` | Retrieve context and fit within token budget |
| `compress_prompt` | Compress text while preserving identifiers |

**Example prompts in Cursor**

- "Use contextoptimizer to retrieve context for fixing the login bug"
- "Search symbols for refreshToken"
- "Find dependencies of the AuthService class"

---

## TypeScript SDK

```bash
pnpm add @contextoptimizer/sdk-ts   # when published
# or use workspace package from this monorepo
```

**In-process** (runs engine locally):

```typescript
import { createClient } from "@contextoptimizer/sdk-ts";

const client = createClient({ repoPath: "/path/to/repo" });
await client.initialize();
await client.index();

const context = await client.getContext({
  task: "fix the login bug",
  budget: 8000,
  currentFile: "src/auth.ts",
});

await client.close();
```

**Remote** (HTTP API):

```typescript
const client = createClient({
  baseUrl: "http://localhost:3100",
  apiKey: process.env.API_TOKEN,
});

const results = await client.search({ text: "auth token", limit: 10 });
const health = await client.health();
```

---

## Python SDK

```bash
pip install contextoptimizer
```

```python
from contextoptimizer import Client

client = Client("http://localhost:3100", api_key="your-token")

# Index & search
client.index()
results = client.search("auth token refresh", limit=10)

# Context retrieval
context = client.get_context(
    task="fix the login bug",
    budget=8000,
    current_file="src/auth.ts",
)

# Memory
client.remember("Uses JWT refresh tokens", category="architecture", key="auth")
entries = client.recall(category="architecture")
```

---

## Docker Compose

Runs API + Postgres (pgvector) together:

```bash
docker compose up -d
```

| Service | Port | Description |
|---------|------|-------------|
| `api` | 3100 | REST API |
| `postgres` | 5432 | Postgres with pgvector |

Default env (override in `.env` or `docker-compose.yml`):

```env
API_TOKEN=dev-token
DATABASE_URL=postgres://ctxopt:ctxopt@postgres:5432/ctxopt
USE_PGVECTOR=true
EMBEDDING_PROVIDER=fake
```

---

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REPO_PATH` | Repository to index | Current directory |
| `PORT` | API port | `3100` |
| `HOST` | API host | `0.0.0.0` |
| `API_TOKEN` | Bearer token for API auth | — (disabled) |
| `DATABASE_URL` | Postgres connection string | SQLite in `.contextoptimizer/` |
| `USE_PGVECTOR` | Use pgvector for embeddings | `true` when Postgres |
| `EMBEDDING_PROVIDER` | `fake`, `openai`, `voyage` | `fake` |
| `OPENAI_API_KEY` | OpenAI embeddings | — |
| `VOYAGE_API_KEY` | Voyage embeddings | — |
| `EMBEDDING_DIMENSIONS` | Vector dimensions (pgvector) | `384` |
| `RATE_LIMIT_MAX` | API requests per window | `100` |
| `DEFAULT_BUDGET` | Default token budget | `8000` |

---

## Benchmarks

Compare ContextOptimizer vs naive retrieval and simple RAG:

```bash
pnpm --filter @contextoptimizer/benchmarks bench
```

---

## Documentation

Full docs site (architecture, plugin guides, deployment):

```bash
pnpm --filter @contextoptimizer/docs start
# → http://localhost:3000
```

Key guides in `apps/docs/docs/`:

- [Architecture](apps/docs/docs/architecture/overview.md)
- [Developer guide](apps/docs/docs/guides/developer.md)
- [Deployment](apps/docs/docs/guides/deployment.md)
- [Adding an embedder](apps/docs/docs/plugins/embedder.md)
- [Adding a language parser](apps/docs/docs/plugins/parser.md)
- [API reference](apps/docs/docs/api/reference.md)

---

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

---

## Packages

| Package | Description |
|---------|-------------|
| `@contextoptimizer/core` | Types, interfaces, Zod schemas |
| `@contextoptimizer/engine` | High-level facade |
| `@contextoptimizer/parser` | tree-sitter symbol extraction |
| `@contextoptimizer/indexer` | Git-aware incremental indexer |
| `@contextoptimizer/graph` | Dependency graph |
| `@contextoptimizer/retrieval` | Hybrid search + context assembly |
| `@contextoptimizer/ranking` | Multi-factor ranker |
| `@contextoptimizer/compression` | Prompt compression pipeline |
| `@contextoptimizer/memory` | Persistent project memory |
| `@contextoptimizer/embeddings` | Fake, OpenAI, Voyage providers |
| `@contextoptimizer/vector-store` | In-memory, LanceDB, pgvector |
| `@contextoptimizer/storage` | SQLite adapter |
| `@contextoptimizer/storage-postgres` | Postgres adapter |
| `@contextoptimizer/observability` | Metrics + logging |
| `@contextoptimizer/sdk-ts` | TypeScript SDK |
| `contextoptimizer` (PyPI) | Python SDK |
| `@contextoptimizer/api` | REST API server |
| `@contextoptimizer/cli` | `omni` CLI |
| `@contextoptimizer/mcp` | MCP server |
| `@contextoptimizer/docs` | Docusaurus documentation |

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for phased development (Phases 0–10 complete; VS Code extension and post-1.0 items in backlog).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [contributing guide](apps/docs/docs/guides/contributing.md).

## License

MIT
