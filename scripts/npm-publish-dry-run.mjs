import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("Running pnpm publish dry-run for all non-private workspace packages...\n");

try {
  execSync(
    "pnpm publish -r --dry-run --no-git-checks --filter \"!contextoptimizer\" --filter \"!@contextoptimizer/docs\" --filter \"!@contextoptimizer/benchmarks\"",
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  console.log("\nAll dry-runs completed successfully.");
} catch {
  console.error("\nDry-run failed. Fix errors above before publishing.");
  process.exit(1);
}
