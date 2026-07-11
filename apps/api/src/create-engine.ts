import { resolve } from "node:path";
import { createEmbedderFromEnv } from "@contextoptimizer/embeddings";
import { type EngineConfig, createEngine } from "@contextoptimizer/engine";
import { createLogger } from "@contextoptimizer/observability";
import { createPostgresStorage } from "@contextoptimizer/storage-postgres";
import { createInMemoryVectorStore, createPgVectorStore } from "@contextoptimizer/vector-store";

const logger = createLogger({ name: "api" });

export function createEngineFromEnv(): ReturnType<typeof createEngine> {
  const repoPath = resolve(process.env.REPO_PATH ?? process.cwd());
  const embedder = createEmbedderFromEnv({
    onDegrade: (error) => {
      logger.warn({ error }, "Embedding provider degraded to local code-aware embedder");
    },
  });

  const config: EngineConfig = {
    repoPath,
    embedder,
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
        dimensions: embedder.dimensions,
      });
    } else {
      config.vectorStore = createInMemoryVectorStore();
    }
  }

  return createEngine(config);
}
