---
title: Contributing
---

# Contributing

See [CONTRIBUTING.md](https://github.com/contextoptimizer/contextoptimizer/blob/main/CONTRIBUTING.md) in the repository.

## Good first issues

Look for issues labeled `good first issue` on GitHub. These are scoped tasks ideal for new contributors:

- Add a tree-sitter language parser
- Add an embedding provider
- Improve benchmark fixtures
- Documentation fixes

## Development workflow

1. Fork and clone the repo
2. Create a feature branch
3. Make changes with tests
4. Run `pnpm lint && pnpm typecheck && pnpm test`
5. Open a pull request

## Architecture Decision Records

Major decisions are documented in `docs/adr/`. Read these before proposing architectural changes.

## Code style

- TypeScript with strict mode
- Biome for linting and formatting
- Vitest for unit tests
- Conventional commits
