---
title: API Reference
---

# API Reference

Interactive OpenAPI docs are available at `/docs` when the API server is running.

## Base URL

```
http://localhost:3100
```

## Authentication

When `API_TOKEN` is set, include a Bearer token:

```
Authorization: Bearer <token>
```

Public endpoints (no auth): `/health`, `/metrics`, `/docs`

## Endpoints

### GET /health

Returns API status and indexed repo path.

```json
{ "status": "ok", "repoPath": "/path/to/repo" }
```

### GET /metrics

Prometheus-format metrics.

### GET /doctor

Health diagnostics.

```json
{
  "healthy": true,
  "checks": {
    "storage": true,
    "indexed": true,
    "chunks": true,
    "vectors": true,
    "repoExists": true
  }
}
```

### POST /index

Index the repository.

**Body:** `{ "force": false }`

### POST /search

Semantic search.

**Body:** `{ "text": "query", "limit": 20, "filePath": "optional" }`

### POST /context

Get ranked, budgeted context.

**Body:** `{ "task": "...", "budget": 8000, "currentFile": "..." }`

### POST /compress

Compress a prompt.

**Body:** `{ "text": "...", "targetTokens": 4000 }`

### POST /budget

Fit snippets within a token budget.

**Body:** `{ "snippets": [...], "budget": 8000 }`

### POST /symbols

Query symbols.

**Body:** `{ "name": "refreshToken", "kind": "function" }`

### POST /graph

Graph neighbors.

**Body:** `{ "nodeId": "sym:...", "depth": 2 }`

### POST /memory

Remember or recall.

**Remember:** `{ "action": "remember", "category": "architecture", "key": "auth", "content": "..." }`

**Recall:** `{ "action": "recall", "category": "architecture" }`

## Rate limiting

Default: 100 requests per minute per IP. Configure with `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW`.

## OpenAPI spec

Visit `http://localhost:3100/docs` for the full interactive spec generated from Fastify route schemas.
