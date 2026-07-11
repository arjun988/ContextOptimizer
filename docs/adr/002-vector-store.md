# ADR-002: Pluggable Vector Stores with pgvector

## Status

Accepted

## Context

Semantic search requires vector similarity. In-memory stores lose data on process exit. Production needs persistent vectors.

## Decision

Define a `VectorStore` interface with three implementations:

1. `InMemoryVectorStore` — default for CLI (fast, ephemeral)
2. `LanceDbVectorStore` — optional disk-based store
3. `PgVectorStore` — Postgres pgvector for production

The engine warms the vector store from stored chunks on `initialize()` so search works across process restarts even with in-memory stores.

When `DATABASE_URL` is set, the API defaults to `PgVectorStore` for persistent embeddings.

## Consequences

- Vectors survive API restarts when using Postgres
- `EMBEDDING_DIMENSIONS` must match the embedder output size for pgvector
- IVFFlat index is created on startup; falls back to brute-force cosine if pgvector ops fail
