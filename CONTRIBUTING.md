# Contributing to ContextOptimizer

Thank you for your interest in contributing!

## Development Setup

```bash
pnpm install
pnpm build
pnpm test
```

## Project Structure

- `packages/core` — shared types, interfaces, and utilities
- `packages/indexer` — repository scanning and incremental indexing
- `packages/parser` — tree-sitter AST parsing
- `packages/graph` — dependency graph
- `packages/embeddings` — embedding providers
- `packages/vector-store` — vector storage adapters
- `packages/retrieval` — context retrieval engine
- `packages/ranking` — multi-factor ranking
- `packages/engine` — facade composing all modules

## Guidelines

- Follow existing code style (Biome handles formatting)
- Add tests for new behavior
- Keep packages independent — no circular dependencies
- Define interfaces in `core` before implementations

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Ensure `pnpm lint && pnpm typecheck && pnpm test` pass
4. Submit a PR with a clear description
