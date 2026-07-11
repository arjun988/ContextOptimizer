import type { Logger } from "@contextoptimizer/core";
import pino from "pino";
import type { Metrics } from "./types.js";

export type { Metrics } from "./types.js";

export interface LoggerOptions {
  level?: string;
  name?: string;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const pinoLogger = pino({
    level: options.level ?? "info",
    name: options.name ?? "contextoptimizer",
  });

  const wrap = (child: pino.Logger): Logger => ({
    debug: (obj, msg) => child.debug(obj, msg),
    info: (obj, msg) => child.info(obj, msg),
    warn: (obj, msg) => child.warn(obj, msg),
    error: (obj, msg) => child.error(obj, msg),
    child: (bindings) => wrap(child.child(bindings)),
  });

  return wrap(pinoLogger);
}

export function createMetrics(): Metrics {
  return {
    retrievedTokens: 0,
    compressedTokens: 0,
    savedTokens: 0,
    latencyMs: 0,
    cacheHits: 0,
    cacheMisses: 0,
    embeddingLatencyMs: 0,
    rankingLatencyMs: 0,
  };
}

export * from "./metrics.js";
