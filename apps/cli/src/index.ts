#!/usr/bin/env node
import { resolve } from "node:path";
import { createEngine } from "@contextoptimizer/engine";
import { Command } from "commander";

const program = new Command();
const repoPath = resolve(process.env.REPO_PATH ?? process.cwd());

async function withEngine<T>(
  fn: (engine: ReturnType<typeof createEngine>) => Promise<T>,
): Promise<T> {
  const engine = createEngine({ repoPath });
  await engine.initialize();
  try {
    return await fn(engine);
  } finally {
    await engine.close();
  }
}

program.name("omni").description("ContextOptimizer CLI").version("0.1.0");

program
  .command("index")
  .option("--force", "Force full re-index")
  .action(async (opts: { force?: boolean }) => {
    await withEngine(async (engine) => {
      const result = await engine.index({ force: opts.force });
      console.log(JSON.stringify(result, null, 2));
    });
  });

program
  .command("search <query>")
  .option("-l, --limit <n>", "Result limit", "10")
  .action(async (query: string, opts: { limit: string }) => {
    await withEngine(async (engine) => {
      const results = await engine.search({ text: query, limit: Number(opts.limit) });
      console.log(JSON.stringify(results, null, 2));
    });
  });

program
  .command("context <task>")
  .option("-b, --budget <n>", "Token budget", "8000")
  .option("-f, --file <path>", "Current file")
  .action(async (task: string, opts: { budget: string; file?: string }) => {
    await withEngine(async (engine) => {
      const result = await engine.getContext({
        task,
        currentFile: opts.file,
        budget: Number(opts.budget),
      });
      console.log(JSON.stringify(result, null, 2));
    });
  });

program
  .command("memory <action>")
  .option("-c, --category <cat>", "Memory category")
  .option("-k, --key <key>", "Memory key")
  .option("-t, --text <text>", "Content to remember")
  .action(async (action: string, opts: { category?: string; key?: string; text?: string }) => {
    await withEngine(async (engine) => {
      if (action === "remember") {
        const result = await engine.remember({
          category: (opts.category ?? "project_summary") as never,
          key: opts.key ?? "default",
          content: opts.text ?? "",
        });
        console.log(JSON.stringify(result, null, 2));
      } else {
        const result = await engine.recall({
          category: opts.category as never,
          key: opts.key,
        });
        console.log(JSON.stringify(result, null, 2));
      }
    });
  });

program
  .command("budget")
  .requiredOption("-b, --budget <n>", "Token budget")
  .action(async (opts: { budget: string }) => {
    await withEngine(async (engine) => {
      const context = await engine.getContext({
        task: "budget check",
        budget: Number(opts.budget),
      });
      const budgeted = await engine.budget({
        snippets: context.snippets,
        budget: Number(opts.budget),
      });
      console.log(JSON.stringify(budgeted, null, 2));
    });
  });

program
  .command("graph <nodeId>")
  .option("-d, --depth <n>", "Traversal depth", "1")
  .action(async (nodeId: string, opts: { depth: string }) => {
    await withEngine(async (engine) => {
      const result = await engine.neighbors(nodeId, Number(opts.depth));
      console.log(JSON.stringify(result, null, 2));
    });
  });

program.command("doctor").action(async () => {
  await withEngine(async (engine) => {
    const result = await engine.doctor();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.healthy ? 0 : 1);
  });
});

program.parse();
