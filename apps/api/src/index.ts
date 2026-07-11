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
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { createEngineFromEnv } from "./create-engine.js";

const port = Number(process.env.PORT ?? 3100);
const host = process.env.HOST ?? "0.0.0.0";
const apiToken = process.env.API_TOKEN;

const engine = createEngineFromEnv();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_MAX ?? 100),
  timeWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute",
});

await app.register(swagger, {
  openapi: {
    info: {
      title: "ContextOptimizer API",
      description: "AI Context Optimization Engine REST API",
      version: "1.0.0",
    },
    servers: [{ url: `http://${host}:${port}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
    security: apiToken ? [{ bearerAuth: [] }] : [],
  },
});

await app.register(swaggerUi, { routePrefix: "/docs" });
await engine.initialize();

if (apiToken) {
  app.addHook("onRequest", async (req, reply) => {
    const publicPaths = ["/health", "/metrics", "/docs", "/docs/"];
    if (publicPaths.some((p) => req.url.startsWith(p))) return;
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${apiToken}`) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
}

app.get(
  "/health",
  {
    schema: {
      description: "Health check",
      tags: ["system"],
      response: { 200: { type: "object" } },
    },
  },
  async () => ({ status: "ok", repoPath: engine.getRepoPath() }),
);

app.get(
  "/metrics",
  {
    schema: { description: "Prometheus metrics", tags: ["system"] },
  },
  async (_req, reply) => {
    reply.type("text/plain");
    return engine.getPrometheusMetrics();
  },
);

app.post(
  "/index",
  {
    schema: {
      description: "Index repository",
      tags: ["index"],
      body: { type: "object", properties: { force: { type: "boolean" } } },
    },
  },
  async (req) => {
    const body = (req.body ?? {}) as { force?: boolean };
    return engine.index(body);
  },
);

app.post(
  "/search",
  {
    schema: { description: "Semantic search", tags: ["retrieval"] },
  },
  async (req) => {
    const query = SearchQuerySchema.parse(req.body);
    return engine.search(query as never);
  },
);

app.post(
  "/context",
  {
    schema: { description: "Get ranked context", tags: ["retrieval"] },
  },
  async (req) => {
    const request = ContextRequestSchema.parse(req.body);
    return engine.getContext(request);
  },
);

app.post(
  "/compress",
  {
    schema: { description: "Compress prompt", tags: ["compression"] },
  },
  async (req) => {
    const request = CompressRequestSchema.parse(req.body);
    return engine.compress(request);
  },
);

app.post(
  "/budget",
  {
    schema: { description: "Fit snippets in token budget", tags: ["retrieval"] },
  },
  async (req) => {
    const body = req.body as { snippets: unknown[]; budget: number };
    BudgetRequestSchema.parse({ budget: body.budget });
    return engine.budget({ snippets: body.snippets as never, budget: body.budget });
  },
);

app.post(
  "/symbols",
  {
    schema: { description: "Query symbols", tags: ["index"] },
  },
  async (req) => {
    const query = SymbolQuerySchema.parse(req.body);
    return engine.getSymbols(query as never);
  },
);

app.post(
  "/graph",
  {
    schema: { description: "Graph neighbors", tags: ["graph"] },
  },
  async (req) => {
    const query = NeighborQuerySchema.parse(req.body);
    return engine.neighbors(query.nodeId, query.depth ?? 1);
  },
);

app.post(
  "/memory",
  {
    schema: { description: "Remember or recall memory", tags: ["memory"] },
  },
  async (req) => {
    const body = req.body as { action: string };
    if (body.action === "remember") {
      const entry = MemoryEntrySchema.parse(body);
      return engine.remember(entry as never);
    }
    const query = MemoryQuerySchema.parse(body);
    return engine.recall(query as never);
  },
);

app.get(
  "/doctor",
  {
    schema: { description: "Health diagnostics", tags: ["system"] },
  },
  async () => engine.doctor(),
);

app.addHook("onClose", async () => {
  await engine.close();
});

await app.listen({ port, host });
console.log(`ContextOptimizer API listening on http://${host}:${port}`);
console.log(`OpenAPI docs at http://${host}:${port}/docs`);
