---
title: Developer Guide
---

# Developer Guide

## Prerequisites

- Node.js 22+
- pnpm 9+
- Python 3.10+ (for Python SDK)

## Setup

```bash
git clone https://github.com/contextoptimizer/contextoptimizer.git
cd contextoptimizer
pnpm install
pnpm build
pnpm test
```

## Monorepo layout

- `packages/` — libraries (core, engine, storage, etc.)
- `apps/` — CLI, API, MCP server, docs
- `benchmarks/` — retrieval benchmarks

## Running locally

### CLI

```bash
pnpm omni index
pnpm omni search "auth token"
pnpm omni context "fix login" --budget 8000
```

### API

```bash
REPO_PATH=. pnpm --filter @contextoptimizer/api start
```

### With Postgres + pgvector

```bash
docker compose up -d
DATABASE_URL=postgres://ctxopt:ctxopt@localhost:5432/ctxopt \
  USE_PGVECTOR=true \
  pnpm --filter @contextoptimizer/api start
```

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REPO_PATH` | Repository to index | `cwd` |
| `DATABASE_URL` | Postgres connection string | SQLite in `.contextoptimizer/` |
| `USE_PGVECTOR` | Use pgvector for embeddings | `true` when Postgres |
| `EMBEDDING_PROVIDER` | `fake`, `openai`, `voyage` | `fake` |
| `OPENAI_API_KEY` | OpenAI embeddings key | — |
| `API_TOKEN` | Bearer token for API auth | — |
| `RATE_LIMIT_MAX` | Requests per window | `100` |
