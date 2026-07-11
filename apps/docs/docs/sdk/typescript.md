---
title: TypeScript SDK
---

# TypeScript SDK

Package: `@contextoptimizer/sdk-ts`

## Installation

```bash
pnpm add @contextoptimizer/sdk-ts
```

## In-process mode

```typescript
import { createClient } from "@contextoptimizer/sdk-ts";

const client = createClient({ repoPath: "/path/to/repo" });
await client.initialize();
await client.index();
const context = await client.getContext({
  task: "fix the login bug",
  budget: 8000,
});
await client.close();
```

## Remote mode

```typescript
import { createClient } from "@contextoptimizer/sdk-ts";

const client = createClient({
  baseUrl: "http://localhost:3100",
  apiKey: process.env.API_TOKEN,
});

const results = await client.search({ text: "auth token refresh", limit: 10 });
const health = await client.health();
const metrics = await client.metrics();
```

## API surface

| Method | Description |
|--------|-------------|
| `index(options?)` | Index repository |
| `search(query)` | Semantic search |
| `getContext(request)` | Ranked, budgeted context |
| `compress(request)` | Compress prompt |
| `budget(request)` | Fit snippets in budget |
| `getSymbols(query)` | Query symbols |
| `remember(entry)` | Store memory |
| `recall(query)` | Retrieve memory |
| `neighbors(nodeId, depth)` | Graph traversal |
| `doctor()` | Health diagnostics |
| `health()` | API health (remote only) |
| `metrics()` | Prometheus metrics (remote only) |
