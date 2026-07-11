---
title: Adding a Vector Store
---

# Adding a Vector Store

Vector stores persist and search embedding vectors.

## Interface

```typescript
interface VectorStore {
  readonly name: string;
  initialize(): Promise<void>;
  close(): Promise<void>;
  upsert(items: { id, vector, metadata }[]): Promise<void>;
  delete(ids: string[]): Promise<void>;
  search(vector, limit, filter?): Promise<{ id, score, metadata }[]>;
  count(): Promise<number>;
}
```

## Existing implementations

| Store | Package | Persistence |
|-------|---------|-------------|
| `InMemoryVectorStore` | `vector-store` | Process lifetime |
| `LanceDbVectorStore` | `vector-store` | Disk (LanceDB) |
| `PgVectorStore` | `vector-store` | Postgres + pgvector |

## Steps

1. Create a class in `packages/vector-store/src/`
2. Implement all interface methods
3. Use cosine similarity for `score` (higher = more similar)
4. Support optional `filter` on metadata keys (see `InMemoryVectorStore`)
5. Export from `packages/vector-store/src/index.ts`
6. Wire into engine via `EngineConfig.vectorStore`

## Example: inject custom store

```typescript
import { createEngine } from "@contextoptimizer/engine";
import { createMyVectorStore } from "./my-store";

const engine = createEngine({
  repoPath: "/path/to/repo",
  vectorStore: createMyVectorStore({ path: "./vectors" }),
});
```

## Postgres pgvector

When `DATABASE_URL` is set, the API automatically uses `PgVectorStore`:

```env
DATABASE_URL=postgres://user:pass@localhost:5432/ctxopt
USE_PGVECTOR=true
EMBEDDING_DIMENSIONS=384
```

The engine warms vectors from stored chunks on startup, so search works across process restarts.
