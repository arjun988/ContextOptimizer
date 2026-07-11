# ContextOptimizer

A production-grade, open-source **AI Context Optimization Engine** — middleware between any AI coding assistant and a repository. It indexes your codebase, ranks the most relevant snippets, and returns only what the agent needs so you get better answers with fewer tokens.

**No API keys required. No cloud hosting required.** Everything runs on your machine.

---

## How it works

```mermaid
flowchart LR
  subgraph userMachine [Your machine]
    MCP[MCP Server]
    Engine[Context Engine]
    Index[(SQLite index\n.contextoptimizer/)]
    Embedder[CodeAware Embedder\nlocal, no API key]
    MCP --> Engine
    Engine --> Index
    Engine --> Embedder
  end

  Cursor[Cursor / Claude / Kiro] -->|stdio tools| MCP
  MCP -->|ranked snippets| Cursor
```

1. **Index** — tree-sitter parses your repo, extracts symbols, builds a dependency graph, and stores chunks in SQLite.
2. **Search** — hybrid BM25 keyword search + local vector similarity finds candidate snippets.
3. **Rank** — multi-factor scoring (semantic match, graph distance, open files, recency, popularity).
4. **Select** — adaptive token selection picks only high-relevance snippets (no fixed budget unless you set one).
5. **Return** — the agent receives ranked context instead of dumping whole files into the prompt.

Index data lives at `<REPO_PATH>/.contextoptimizer/` (SQLite + in-memory vectors). Nothing is sent to a ContextOptimizer server — there isn't one.

---

## What it does

| Capability | Description |
|------------|-------------|
| **Incremental indexing** | tree-sitter parsing, symbol extraction, hash-based re-indexing |
| **Dependency graph** | Cross-file imports, calls, references with distance traversal |
| **Hybrid search** | BM25 keyword + local vector similarity |
| **Context retrieval** | Multi-factor ranking (semantic, graph, popularity, recency) |
| **Adaptive token selection** | Repo-size-aware snippet selection; optional hard budget |
| **Compression** | Dedupe, merge, skeleton summarization with identifier preservation |
| **Memory** | Project summaries, architecture notes, conversation history |
| **Observability** | Prometheus metrics, structured logging |

---

## Who is this for?

| User | Recommended setup |
|------|-------------------|
| **Cursor / Claude / Kiro users** | MCP server (`@contextoptimizer/mcp`) — zero config beyond `REPO_PATH` |
| **Script / CI users** | CLI (`omni`) |
| **Team with shared index** | Self-hosted REST API + optional Docker Compose (Postgres) |
| **Python integrators** | `pip install contextoptimizer` — HTTP client to a local API you run |

You do **not** need OpenAI, Voyage, AWS, or any hosted service from the ContextOptimizer project.

---

## Prerequisites

- **Node.js** 22+
- **An MCP client** — Cursor, Claude Desktop, Kiro, or similar (for the recommended path)
- **pnpm** 9+ — only if building from source

---

## Quick start — MCP (recommended)

This is what most users want: install the MCP package, point it at your project, and use it from chat.

### Option A: npm (after publish)

```bash
# No global install required — npx downloads on first use
```

Add to **Cursor Settings → MCP** (or `.cursor/mcp.json` in your project):

```json
{
  "mcpServers": {
    "contextoptimizer": {
      "command": "npx",
      "args": ["-y", "@contextoptimizer/mcp"],
      "env": {
        "REPO_PATH": "C:/absolute/path/to/your/project"
      }
    }
  }
}
```

Or install globally:

```bash
npm install -g @contextoptimizer/mcp
```

```json
{
  "mcpServers": {
    "contextoptimizer": {
      "command": "contextoptimizer-mcp",
      "env": {
        "REPO_PATH": "C:/absolute/path/to/your/project"
      }
    }
  }
}
```

> Use **absolute paths** for `REPO_PATH`. This should be the codebase you want indexed (your app), not the ContextOptimizer repo itself.

Restart Cursor after saving.

### Option B: Build from source (contributors / pre-publish)

```bash
git clone https://github.com/contextoptimizer/contextoptimizer.git
cd contextoptimizer
pnpm install
pnpm build
```

Copy the example MCP config:

```bash
mkdir -p .cursor
cp mcp.json.example .cursor/mcp.json
# Edit REPO_PATH and paths in mcp.json
```

Or paste into Cursor MCP settings:

```json
{
  "mcpServers": {
    "contextoptimizer": {
      "command": "node",
      "args": ["C:/absolute/path/to/ContextOptimizer/apps/mcp-server/dist/index.js"],
      "env": {
        "REPO_PATH": "C:/absolute/path/to/your/project"
      }
    }
  }
}
```

### First use in chat

Ask the agent to use ContextOptimizer:

```
Use contextoptimizer to index this repository, then retrieve context for fixing the login bug.
```

Or step by step:

| Step | Tool | What it does |
|------|------|--------------|
| 1 | `index_repository` | Parse and index the repo (run once per project, or after big changes) |
| 2 | `doctor` | Verify storage, chunks, and vectors are healthy |
| 3 | `retrieve_context` | Get ranked snippets for your task |

**Example `retrieve_context` call** — no budget needed (adaptive selection is the default):

```json
{
  "task": "how does the auth token refresh work",
  "currentFile": "src/auth.ts"
}
```

Optional: pass `"budget": 6000` to cap tokens explicitly.

### Verify installation

```bash
# From source
pnpm --filter @contextoptimizer/mcp test
```

This runs: list tools → index → doctor → retrieve context (end-to-end).

---

## MCP tools (10)

| Tool | Description |
|------|-------------|
| `index_repository` | Index or re-index the repo (`force: true` for full rebuild) |
| `doctor` | Health check — storage, chunks, vectors |
| `retrieve_context` | Ranked context for a coding task (adaptive tokens by default) |
| `search_symbols` | Search symbols by name + hybrid query |
| `find_dependencies` | Graph neighbors within N hops |
| `project_summary` | Stored project summary + top symbols |
| `search_docs` | Search `.md` files |
| `conversation_summary` | Remember / recall conversation summaries |
| `budget_context` | Retrieve context and fit within an explicit token budget |
| `compress_prompt` | Compress text while preserving identifiers |

**Example prompts**

- "Index this repo with contextoptimizer"
- "Use retrieve_context for: refactor the auth module"
- "Search symbols for refreshToken"
- "Find dependencies of sym:abc123 within 2 hops"

---

## Embeddings — no API key required

ContextOptimizer ships with a **local, offline embedder** by default. Users never need to provide OpenAI or Voyage keys.

| Provider | API key? | Quality | When to use |
|----------|----------|---------|-------------|
| `local` (default) | No | Good for code + keyword queries | **Default for all npm/MCP users** |
| `openai` | User's own key | Best NL semantic search | Optional upgrade |
| `voyage` | User's own key | Best for code embeddings | Optional upgrade |
| `fake` | No | Testing only | Dev / benchmarks |

The default `CodeAwareEmbedder`:
- Runs entirely on your machine
- Splits camelCase identifiers (`refreshToken` → `refresh`, `token`)
- Combines with BM25 keyword search for hybrid retrieval
- Works offline, no cost per query

To use optional cloud embedders, set env vars in MCP config:

```json
"env": {
  "REPO_PATH": "C:/path/to/project",
  "EMBEDDING_PROVIDER": "openai",
  "OPENAI_API_KEY": "sk-..."
}
```

Then re-index with `force: true` — vectors must be rebuilt when the embedder changes.

---

## Token usage and cost savings

ContextOptimizer saves tokens by **returning only relevant snippets** instead of whole files or unbounded `@codebase` results.

| Scenario | Typical behavior |
|----------|------------------|
| **Small repo** (< 30 chunks) | Adaptive cap ~1500 tokens, max 5 snippets |
| **Medium repo** (30–200 chunks) | Adaptive cap ~4000 tokens |
| **Large repo** (200+ chunks) | Adaptive cap up to ~12000 tokens |
| **Explicit budget** | Pass `budget` to `retrieve_context` or `budget_context` |

Selection stops when relevance drops (snippet score falls below 35% of the top hit), so you don't pay for low-value context.

**Benchmark** (small 4-file fixture, no budget):

| Method | Avg tokens | Recall |
|--------|------------|--------|
| simple-rag (top-5) | ~320 | 100% |
| contextoptimizer (adaptive) | ~290 | 100% |

On large monorepos where Cursor might inject 40k+ tokens of context, capping at a few thousand relevant snippets can reduce input tokens by 80%+. Savings depend on how much context the agent would otherwise load.

---

## CLI (`omni`) — optional

For debugging, scripts, and CI without an MCP client.

```bash
# From source (repo root)
pnpm omni index
pnpm omni search "auth token refresh"
pnpm omni context "fix the login bug"          # adaptive (via engine default)
pnpm omni context "fix the login bug" -b 4000  # explicit budget
pnpm omni doctor
```

After publish:

```bash
npm install -g @contextoptimizer/cli
omni index
omni search "repo indexer" -l 5
```

| Command | Description |
|---------|-------------|
| `omni index [--force]` | Index repository |
| `omni search <query> [-l N]` | Hybrid search |
| `omni context <task> [-b budget] [-f file]` | Ranked context |
| `omni memory remember -t "..." [-c category] [-k key]` | Store a memory entry |
| `omni memory recall [-c category] [-k key]` | Recall memory entries |
| `omni budget -b <tokens>` | Fit snippets within a budget |
| `omni graph <nodeId> [-d depth]` | Graph neighbors |
| `omni doctor` | Health diagnostics |

On re-index, `filesIndexed: 0` with high `filesSkipped` is normal (incremental indexing). Use `--force` for a full rebuild.

---

## REST API — optional (self-hosted)

For teams that want a shared index server on their own infrastructure. You host it — not ContextOptimizer.

```bash
# Local SQLite (simplest)
pnpm --filter @contextoptimizer/api start

# Or with env
REPO_PATH=. PORT=3100 pnpm --filter @contextoptimizer/api start
```

Production-style stack (Postgres + pgvector + auth) — still runs on **your** machine or your team's server:

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
| `/search` | POST | Hybrid search |
| `/context` | POST | Get ranked context |
| `/compress` | POST | Compress prompt |
| `/budget` | POST | Fit snippets in budget |
| `/symbols` | POST | Query symbols |
| `/graph` | POST | Graph neighbors |
| `/memory` | POST | Remember / recall |

When `API_TOKEN` is set, send `Authorization: Bearer <token>` on all routes except `/health`, `/metrics`, and `/docs`.

```bash
curl -X POST http://localhost:3100/search \
  -H "Content-Type: application/json" \
  -d '{"text": "auth token refresh", "limit": 5}'
```

---

## TypeScript SDK

**In-process** — runs the full engine locally (no server, no API key):

```bash
pnpm add @contextoptimizer/sdk-ts   # when published
```

```typescript
import { createClient } from "@contextoptimizer/sdk-ts";

const client = createClient({ repoPath: "/path/to/repo" });
await client.initialize();
await client.index();

const context = await client.getContext({
  task: "fix the login bug",
  currentFile: "src/auth.ts",
  // budget is optional — omit for adaptive selection
});

await client.close();
```

**Remote** — HTTP client to a self-hosted API:

```typescript
const client = createClient({
  baseUrl: "http://localhost:3100",
  apiKey: process.env.API_TOKEN,
});

const results = await client.search({ text: "auth token", limit: 10 });
```

---

## Python SDK

The Python package is an **HTTP client** — it talks to a REST API you run locally. It does not embed or index inside Python.

```bash
pip install contextoptimizer
```

Start the API first (see [REST API](#rest-api--optional-self-hosted)):

```bash
pnpm --filter @contextoptimizer/api start
# or: docker compose up -d
```

```python
from contextoptimizer import Client

client = Client("http://localhost:3100", api_key="your-token")  # api_key optional if API_TOKEN unset

client.index()
results = client.search("auth token refresh", limit=10)

context = client.get_context(
    task="fix the login bug",
    current_file="src/auth.ts",
    # budget is optional
)

client.remember("Uses JWT refresh tokens", category="architecture", key="auth")
entries = client.recall(category="architecture")
```

| npm MCP | pip SDK |
|---------|---------|
| Full engine, runs in Cursor | HTTP client only |
| No server needed | Requires local API on :3100 |
| Best for AI agent users | Best for Python scripts / backends |

---

## Docker Compose (optional, self-hosted)

Runs API + Postgres (pgvector) on your machine — useful for teams, not required for MCP users.

```bash
docker compose up -d
```

| Service | Port | Description |
|---------|------|-------------|
| `api` | 3100 | REST API |
| `postgres` | 5432 | Postgres with pgvector |

Override in `.env` or `docker-compose.yml`:

```env
API_TOKEN=dev-token
DATABASE_URL=postgres://ctxopt:ctxopt@postgres:5432/ctxopt
USE_PGVECTOR=true
EMBEDDING_PROVIDER=local
```

---

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REPO_PATH` | Repository to index | Current directory |
| `EMBEDDING_PROVIDER` | `local`, `openai`, `voyage`, `fake` | `local` |
| `OPENAI_API_KEY` | OpenAI embeddings (optional) | — |
| `VOYAGE_API_KEY` | Voyage embeddings (optional) | — |
| `DEFAULT_BUDGET` | Default token budget (omit for adaptive) | — (adaptive) |
| `PORT` | API port | `3100` |
| `HOST` | API host | `0.0.0.0` |
| `API_TOKEN` | Bearer token for API auth | — (disabled) |
| `DATABASE_URL` | Postgres connection string | SQLite in `.contextoptimizer/` |
| `USE_PGVECTOR` | Use pgvector for embeddings | `true` when Postgres |
| `EMBEDDING_DIMENSIONS` | Vector dimensions (pgvector) | Matches embedder (384 local) |
| `RATE_LIMIT_MAX` | API requests per window | `100` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| MCP tools not showing | Restart Cursor; check absolute paths in `mcp.json` |
| `doctor` shows `vectors: false` | Run `index_repository` with `force: true` |
| Search returns irrelevant results | Re-index after changing `EMBEDDING_PROVIDER` |
| `retrieve_context` returns too many tokens | Omit `budget` to use adaptive selection (default in MCP) |
| `filesIndexed: 0` on re-index | Normal — incremental indexing skips unchanged files |
| Stale index after embedder change | `index_repository` with `force: true` |

---

## Benchmarks

Compare ContextOptimizer vs naive retrieval and simple RAG:

```bash
pnpm --filter @contextoptimizer/benchmarks bench
```

Runs without a fixed budget (adaptive selection). Expect ~5–15% token savings vs simple top-5 RAG on small repos, with higher savings on large codebases.

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
| `@contextoptimizer/mcp` | **MCP server** (primary user-facing package) |
| `@contextoptimizer/cli` | `omni` CLI |
| `@contextoptimizer/engine` | High-level facade |
| `@contextoptimizer/core` | Types, interfaces, Zod schemas |
| `@contextoptimizer/embeddings` | Local, OpenAI, Voyage providers |
| `@contextoptimizer/retrieval` | Hybrid search + context assembly |
| `@contextoptimizer/ranking` | Multi-factor ranker |
| `@contextoptimizer/indexer` | Git-aware incremental indexer |
| `@contextoptimizer/parser` | tree-sitter symbol extraction |
| `@contextoptimizer/graph` | Dependency graph |
| `@contextoptimizer/compression` | Prompt compression pipeline |
| `@contextoptimizer/memory` | Persistent project memory |
| `@contextoptimizer/vector-store` | In-memory, LanceDB, pgvector |
| `@contextoptimizer/storage` | SQLite adapter |
| `@contextoptimizer/storage-postgres` | Postgres adapter |
| `@contextoptimizer/observability` | Metrics + logging |
| `@contextoptimizer/sdk-ts` | TypeScript SDK |
| `contextoptimizer` (PyPI) | Python HTTP SDK |
| `@contextoptimizer/api` | REST API server |
| `@contextoptimizer/docs` | Docusaurus documentation |

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for phased development (Phases 0–10 complete; VS Code extension and post-1.0 items in backlog).

## Publishing

See [docs/RELEASE.md](./docs/RELEASE.md) for npm/PyPI/Docker release instructions, GitHub secrets setup, and dry-run commands.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [contributing guide](apps/docs/docs/guides/contributing.md).

## License

MIT
