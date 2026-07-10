import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine } from "@contextoptimizer/engine";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureRepo = join(__dirname, "../../packages/engine/fixtures/sample-repo");

interface BenchmarkTask {
  name: string;
  query: string;
  expectedSymbols: string[];
}

const TASKS: BenchmarkTask[] = [
  {
    name: "auth-token-refresh",
    query: "where is auth token refreshed",
    expectedSymbols: ["refreshToken", "AuthService"],
  },
  {
    name: "login-flow",
    query: "fix the login bug",
    expectedSymbols: ["login", "LoginController"],
  },
];

interface BenchmarkResult {
  method: string;
  task: string;
  tokens: number;
  latencyMs: number;
  recall: number;
  accuracy: number;
}

async function runNaiveRetrieval(
  engine: ReturnType<typeof createEngine>,
  task: BenchmarkTask,
): Promise<BenchmarkResult> {
  const start = Date.now();
  const files = await engine.getSymbols({ limit: 1000 });
  const content = files.map((s) => s.name).join("\n");
  const tokens = content.length / 4;
  const found = task.expectedSymbols.filter((s) => content.includes(s));
  return {
    method: "naive",
    task: task.name,
    tokens: Math.round(tokens),
    latencyMs: Date.now() - start,
    recall: found.length / task.expectedSymbols.length,
    accuracy: found.length / task.expectedSymbols.length,
  };
}

async function runSimpleRag(
  engine: ReturnType<typeof createEngine>,
  task: BenchmarkTask,
): Promise<BenchmarkResult> {
  const start = Date.now();
  const results = await engine.search({ text: task.query, limit: 5 });
  const tokens = results.reduce((sum, r) => sum + r.content.length / 4, 0);
  const content = results.map((r) => r.content).join("\n");
  const found = task.expectedSymbols.filter((s) => content.includes(s));
  return {
    method: "simple-rag",
    task: task.name,
    tokens: Math.round(tokens),
    latencyMs: Date.now() - start,
    recall: found.length / task.expectedSymbols.length,
    accuracy: found.length / task.expectedSymbols.length,
  };
}

async function runContextOptimizer(
  engine: ReturnType<typeof createEngine>,
  task: BenchmarkTask,
): Promise<BenchmarkResult> {
  const start = Date.now();
  const context = await engine.getContext({ task: task.query, budget: 4000 });
  const content = context.snippets.map((s) => s.content).join("\n");
  const found = task.expectedSymbols.filter((s) => content.includes(s));
  return {
    method: "contextoptimizer",
    task: task.name,
    tokens: context.totalTokens,
    latencyMs: Date.now() - start,
    recall: found.length / task.expectedSymbols.length,
    accuracy: found.length / task.expectedSymbols.length,
  };
}

async function main() {
  const engine = createEngine({
    repoPath: fixtureRepo,
    dataDir: join(fixtureRepo, ".benchmark-data"),
  });
  await engine.initialize();
  await engine.index({ force: true });

  const results: BenchmarkResult[] = [];
  for (const task of TASKS) {
    results.push(await runNaiveRetrieval(engine, task));
    results.push(await runSimpleRag(engine, task));
    results.push(await runContextOptimizer(engine, task));
  }

  await engine.close();

  console.log("\n=== ContextOptimizer Benchmark Report ===\n");
  console.log("| Method | Task | Tokens | Latency | Recall |");
  console.log("|--------|------|--------|---------|--------|");
  for (const r of results) {
    console.log(
      `| ${r.method} | ${r.task} | ${r.tokens} | ${r.latencyMs}ms | ${(r.recall * 100).toFixed(0)}% |`,
    );
  }

  const ctxResults = results.filter((r) => r.method === "contextoptimizer");
  const ragResults = results.filter((r) => r.method === "simple-rag");
  const avgCtxTokens = ctxResults.reduce((s, r) => s + r.tokens, 0) / ctxResults.length;
  const avgRagTokens = ragResults.reduce((s, r) => s + r.tokens, 0) / ragResults.length;
  const savings = ((avgRagTokens - avgCtxTokens) / avgRagTokens) * 100;

  console.log(`\nAverage token savings vs simple RAG: ${savings.toFixed(1)}%`);
  console.log(
    `Average recall: ContextOptimizer ${((ctxResults.reduce((s, r) => s + r.recall, 0) / ctxResults.length) * 100).toFixed(0)}% vs RAG ${((ragResults.reduce((s, r) => s + r.recall, 0) / ragResults.length) * 100).toFixed(0)}%`,
  );
}

main().catch(console.error);
