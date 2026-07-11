---
title: Architecture Overview
---

# Architecture Overview

ContextOptimizer is a modular monorepo. Each package implements a narrow interface from `@contextoptimizer/core`.

```mermaid
graph TB
    CLI[CLI omni] --> Engine
    API[REST API] --> Engine
    MCP[MCP Server] --> Engine
    SDK[SDKs] --> API
    SDK --> Engine

    Engine --> Indexer
    Engine --> Parser
    Engine --> Graph
    Engine --> Retrieval
    Engine --> Ranking
    Engine --> Compression
    Engine --> Memory
    Engine --> Storage[(StorageAdapter)]
    Engine --> Vectors[(VectorStore)]
    Engine --> Embedder

    Indexer --> Parser
    Indexer --> Storage
    Retrieval --> Storage
    Retrieval --> Vectors
    Retrieval --> Embedder
    Retrieval --> Graph
    Retrieval --> Ranking
```

## Packages

| Package | Role |
|---------|------|
| `core` | Types, interfaces, Zod schemas |
| `parser` | tree-sitter symbol extraction |
| `indexer` | Git-aware file scanner |
| `storage` | SQLite adapter |
| `storage-postgres` | Postgres adapter |
| `graph` | Dependency graph |
| `embeddings` | Embedding providers |
| `vector-store` | In-memory, LanceDB, pgvector |
| `retrieval` | Hybrid search + context assembly |
| `ranking` | Multi-factor ranker |
| `compression` | Prompt compression |
| `memory` | Persistent memory |
| `engine` | Facade wiring all modules |
| `sdk-ts` / `sdk-python` | Client libraries |

## Data flow

1. **Index** — scan files → parse symbols → store in DB → embed chunks → upsert vectors
2. **Search** — embed query → hybrid BM25 + vector search → rank → graph expand → budget fill
3. **Compress** — dedupe → merge → skeleton → summarize to target tokens
