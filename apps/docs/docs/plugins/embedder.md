---
title: Adding an Embedder
---

# Adding an Embedder

Embedders implement the `Embedder` interface from `@contextoptimizer/core`.

## Interface

```typescript
interface Embedder {
  readonly provider: string;
  readonly model: string;
  readonly dimensions: number;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
```

## Steps

1. Create a class in `packages/embeddings/src/providers.ts` (or a new file)
2. Implement `embed()` — accept `texts: string[]`, return `embeddings: number[][]`
3. Set `provider`, `model`, and `dimensions` as readonly properties
4. Export from `packages/embeddings/src/index.ts`
5. Wire into `apps/api/src/create-engine.ts` via `EMBEDDING_PROVIDER` env var
6. Add tests in `packages/embeddings/src/providers.test.ts`

## Example: custom provider

```typescript
export class MyEmbedder implements Embedder {
  readonly provider = "my-provider";
  readonly model = "my-model-v1";
  readonly dimensions = 512;

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const embeddings = await callMyApi(request.texts);
    return {
      embeddings,
      model: this.model,
      provider: this.provider,
      dimensions: this.dimensions,
    };
  }
}
```

## Resilient fallback

Wrap remote providers with `ResilientEmbedder` to fall back to `FakeEmbedder` when the API is down:

```typescript
const embedder = new ResilientEmbedder(
  new OpenAIEmbedder({ apiKey }),
  new FakeEmbedder(),
  (error) => logger.warn({ error }, "Degraded to fake embedder"),
);
```

## Configuration

Set environment variables:

```env
EMBEDDING_PROVIDER=my-provider
MY_PROVIDER_API_KEY=...
EMBEDDING_DIMENSIONS=512
```

When using pgvector, `EMBEDDING_DIMENSIONS` must match your model's output size.
