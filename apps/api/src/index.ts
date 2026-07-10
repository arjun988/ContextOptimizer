import { resolve } from "node:path";
import {
  BudgetRequestSchema,
  CompressRequestSchema,
  ContextRequestSchema,
  MemoryEntrySchema,
  MemoryQuerySchema,
  NeighborQuerySchema,
  SearchQuerySchema,
  SymbolQuerySchema,
} from "@contextoptimizer/core";
import { createEngine } from "@contextoptimizer/engine";
import cors from "@fastify/cors";
import Fastify from "fastify";

const repoPath = process.env.REPO_PATH ?? process.cwd();
const port = Number(process.env.PORT ?? 3100);
const host = process.env.HOST ?? "0.0.0.0";

const engine = createEngine({ repoPath: resolve(repoPath) });
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await engine.initialize();

app.get("/health", async () => ({ status: "ok", repoPath: engine.getRepoPath() }));

app.get("/metrics", async (_req, reply) => {
  reply.type("text/plain");
  return engine.getPrometheusMetrics();
});

app.post("/index", async (req) => {
  const body = (req.body ?? {}) as { force?: boolean };
  return engine.index(body);
});

app.post("/search", async (req) => {
  const query = SearchQuerySchema.parse(req.body);
  return engine.search(query as never);
});

app.post("/context", async (req) => {
  const request = ContextRequestSchema.parse(req.body);
  return engine.getContext(request);
});

app.post("/compress", async (req) => {
  const request = CompressRequestSchema.parse(req.body);
  return engine.compress(request);
});

app.post("/budget", async (req) => {
  const body = req.body as { snippets: unknown[]; budget: number };
  BudgetRequestSchema.parse({ budget: body.budget });
  return engine.budget({ snippets: body.snippets as never, budget: body.budget });
});

app.post("/symbols", async (req) => {
  const query = SymbolQuerySchema.parse(req.body);
  return engine.getSymbols(query as never);
});

app.post("/graph", async (req) => {
  const query = NeighborQuerySchema.parse(req.body);
  return engine.neighbors(query.nodeId, query.depth ?? 1);
});

app.post("/memory", async (req) => {
  const body = req.body as { action: string };
  if (body.action === "remember") {
    const entry = MemoryEntrySchema.parse(body);
    return engine.remember(entry as never);
  }
  const query = MemoryQuerySchema.parse(body);
  return engine.recall(query as never);
});

app.get("/doctor", async () => engine.doctor());

app.addHook("onClose", async () => {
  await engine.close();
});

await app.listen({ port, host });
console.log(`ContextOptimizer API listening on http://${host}:${port}`);
