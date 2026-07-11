# ADR-003: API Authentication and Rate Limiting

## Status

Accepted

## Context

The REST API is designed for team-shared index servers. Unauthenticated public exposure risks abuse.

## Decision

- Optional Bearer token auth via `API_TOKEN` environment variable
- Public endpoints: `/health`, `/metrics`, `/docs`
- Rate limiting via `@fastify/rate-limit` (default 100 req/min)
- SDK clients pass `apiKey` as `Authorization: Bearer <token>`

## Consequences

- Local dev works without auth (no `API_TOKEN` set)
- Production deployments should always set `API_TOKEN`
- Python and TypeScript SDKs support `api_key` / `apiKey` parameter
