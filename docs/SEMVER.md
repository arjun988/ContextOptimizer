# Semver Policy

ContextOptimizer follows [Semantic Versioning 2.0.0](https://semver.org/).

## Version 1.0.0 scope

The following are considered **stable** as of v1.0.0:

### REST API

- Endpoint paths (`/index`, `/search`, `/context`, etc.)
- HTTP methods (GET for `/health`, `/metrics`, `/doctor`; POST for mutations)
- Request/response JSON field names (camelCase)
- Zod schema validation rules

Breaking changes to the API require a major version bump.

### SDKs

- `@contextoptimizer/sdk-ts` — method names and parameter shapes
- `contextoptimizer` (Python) — method names and parameter shapes

### Core interfaces

- `StorageAdapter`, `VectorStore`, `Embedder`, `Parser` method signatures in `@contextoptimizer/core`

## Not stable (may change in minor versions)

- Internal package APIs not exported from `core`, `engine`, or SDK entry points
- Ranking weights and default budgets
- FakeEmbedder hash algorithm
- Benchmark fixtures and thresholds

## Release process

1. Add a changeset: `pnpm changeset`
2. Merge to `main`
3. `pnpm changeset version` bumps versions and generates changelogs
4. CI publishes npm packages, PyPI, and Docker images on tag

## Package versioning

| Package | Registry | Version at 1.0 |
|---------|----------|----------------|
| `@contextoptimizer/core` | npm | 1.0.0 |
| `@contextoptimizer/engine` | npm | 1.0.0 |
| `@contextoptimizer/sdk-ts` | npm | 1.0.0 |
| `@contextoptimizer/storage-postgres` | npm | 1.0.0 |
| `contextoptimizer` | PyPI | 1.0.0 |
