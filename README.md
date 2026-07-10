# ContextOptimizer

A production-grade, open-source **AI Context Optimization Engine** — middleware between any AI coding assistant and a repository. Retrieves the minimum context needed to solve a task while maintaining high accuracy.

## Features (Phases 0–4)

- **Monorepo foundation** — pnpm + Turborepo, Biome, Vitest, CI
- **Repository indexer** — gitignore-aware scanning, incremental re-indexing, symbol table
- **AST parser** — tree-sitter for TypeScript, JavaScript, Python, Go, Rust, Java, C, C++
- **Dependency graph** — files, symbols, imports, calls; traversal by distance
- **Semantic search** — pluggable embeddings (OpenAI, Voyage, local, fake) + hybrid BM25
- **Context retrieval** — multi-factor ranking with token budgets

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Usage

```typescript
import { createEngine } from "@contextoptimizer/engine";

const engine = createEngine({ repoPath: "/path/to/your/repo" });
await engine.initialize();

// Index the repository
const result = await engine.index();
console.log(`Indexed ${result.stats.symbolsExtracted} symbols`);

// Search semantically
const results = await engine.search({ text: "where is auth token refreshed" });

// Get ranked context within a token budget
const context = await engine.getContext({
  task: "fix the login bug",
  currentFile: "src/login.ts",
  cursorPosition: { line: 10, column: 0 },
  budget: 8000,
});

await engine.close();
```

## Packages

| Package | Description |
|---------|-------------|
| `@contextoptimizer/core` | Types, interfaces, Zod schemas |
| `@contextoptimizer/indexer` | Repo scanner + incremental indexing |
| `@contextoptimizer/parser` | tree-sitter AST parsing |
| `@contextoptimizer/graph` | Dependency graph |
| `@contextoptimizer/embeddings` | Embedding providers |
| `@contextoptimizer/vector-store` | Vector storage (in-memory, LanceDB) |
| `@contextoptimizer/retrieval` | Context retrieval + hybrid search |
| `@contextoptimizer/ranking` | Multi-factor ranking |
| `@contextoptimizer/tokenizer` | Token counting + budgets |
| `@contextoptimizer/engine` | High-level facade |

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full phased plan.

## License

MIT
