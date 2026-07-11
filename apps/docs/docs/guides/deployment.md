---
title: Deployment Guide
---

# Deployment Guide

## Docker

Build and run the API:

```bash
docker build -t contextoptimizer-api .
docker run -p 3100:3100 -e REPO_PATH=/repo -v $(pwd):/repo contextoptimizer-api
```

## Docker Compose (API + Postgres + pgvector)

```bash
docker compose up -d
```

Services:

| Service | Port | Description |
|---------|------|-------------|
| `api` | 3100 | ContextOptimizer REST API |
| `postgres` | 5432 | Postgres with pgvector extension |

### Environment

Set in `docker-compose.yml` or `.env`:

```env
API_TOKEN=your-secret-token
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
DATABASE_URL=postgres://ctxopt:ctxopt@postgres:5432/ctxopt
USE_PGVECTOR=true
```

## Production checklist

- Set `API_TOKEN` for authentication
- Configure `RATE_LIMIT_MAX` for your traffic
- Use Postgres + pgvector for persistent vectors
- Set `EMBEDDING_PROVIDER=openai` or `voyage` for real semantic search
- Mount repo volume or set `REPO_PATH`
- Expose `/metrics` to Prometheus
- Run `GET /doctor` in health checks

## GitHub Container Registry

Images are published to `ghcr.io/contextoptimizer/api` on release tags.

```bash
docker pull ghcr.io/contextoptimizer/api:1.0.0
```
