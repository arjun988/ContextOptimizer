# ADR-001: Storage Adapter Abstraction

## Status

Accepted

## Context

ContextOptimizer needs persistent storage for files, symbols, chunks, graph edges, and memory. Different deployments have different requirements: local CLI uses SQLite, production teams may want Postgres.

## Decision

Define a `StorageAdapter` interface in `@contextoptimizer/core` with two implementations:

- `SqliteStorage` — default for CLI and local dev (zero external deps)
- `PostgresStorage` — production adapter in `@contextoptimizer/storage-postgres`

The engine accepts an injected `StorageAdapter` via `EngineConfig.storage` or auto-selects based on `DATABASE_URL`.

## Consequences

- All storage logic is behind one interface; indexer, graph, memory work unchanged
- Postgres migrations mirror SQLite schema 1:1
- Tests can use either backend
