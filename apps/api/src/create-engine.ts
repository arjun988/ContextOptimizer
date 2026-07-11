import { resolve } from "node:path";
import {
  FakeEmbedder,
  OpenAIEmbedder,
  ResilientEmbedder,
  VoyageEmbedder,
} from "@contextoptimizer/embeddings";
import { type EngineConfig, createEngine } from "@contextoptimizer/engine";
import { createLogger } from "@contextoptimizer/observability";
import { createPostgresStorage } from "@contextoptimizer/storage-postgres";
import { createInMemoryVectorStore, createPgVectorStore } from "@contextoptimizer/vector-store";

const logger = createLogger({ name: "api" });

function createEmbedderFromEnv() {
  const fallback = new FakeEmbedder();
  const provider = process.env.EMBEDDING_PROVIDER ?? "fake";

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    const primary = new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY });
    return new ResilientEmbedder(primary, fallback, (error) => {
      logger.warn({ error }, "Embedding provider degraded to fake embedder");
    });
  }

  if (provider === "voyage" && process.env.VOYAGE_API_KEY) {
    const primary = new VoyageEmbedder({ apiKey: process.env.VOYAGE_API_KEY });
    return new ResilientEmbedder(primary, fallback, (error) => {
      logger.warn({ error }, "Embedding provider degraded to fake embedder");
    });
  }

  return fallback;
}

export function createEngineFromEnv(): ReturnType<typeof createEngine> {
  const repoPath = resolve(process.env.REPO_PATH ?? process.cwd());
  const config: EngineConfig = {
    repoPath,
    embedder: createEmbedderFromEnv(),
    defaultBudget: process.env.DEFAULT_BUDGET ? Number(process.env.DEFAULT_BUDGET) : undefined,
  };

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const storage = createPostgresStorage(databaseUrl);
    const pool = storage.getPool();
    config.storage = storage;
    if (process.env.USE_PGVECTOR !== "false") {
      config.vectorStore = createPgVectorStore({
        pool,
        dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 384),
      });
    } else {
      config.vectorStore = createInMemoryVectorStore();
    }
  }

  return createEngine(config);
}
