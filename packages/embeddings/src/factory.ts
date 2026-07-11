import type { Embedder } from "@contextoptimizer/core";
import { CodeAwareEmbedder } from "./code-aware.js";
import { FakeEmbedder, OpenAIEmbedder, ResilientEmbedder, VoyageEmbedder } from "./providers.js";

export interface EmbedderEnvOptions {
  provider?: string;
  openaiApiKey?: string;
  voyageApiKey?: string;
  onDegrade?: (error: unknown) => void;
}

export function createDefaultEmbedder(): Embedder {
  return new CodeAwareEmbedder();
}

export function createEmbedderFromEnv(options: EmbedderEnvOptions = {}): Embedder {
  const fallback = new CodeAwareEmbedder();
  const provider = options.provider ?? process.env.EMBEDDING_PROVIDER ?? "local";

  if (provider === "fake") {
    return new FakeEmbedder();
  }

  if (provider === "openai") {
    const apiKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY;
    if (apiKey) {
      const primary = new OpenAIEmbedder({ apiKey });
      return new ResilientEmbedder(primary, fallback, options.onDegrade);
    }
  }

  if (provider === "voyage") {
    const apiKey = options.voyageApiKey ?? process.env.VOYAGE_API_KEY;
    if (apiKey) {
      const primary = new VoyageEmbedder({ apiKey });
      return new ResilientEmbedder(primary, fallback, options.onDegrade);
    }
  }

  return fallback;
}
