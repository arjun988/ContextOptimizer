import { describe, expect, it } from "vitest";
import { BudgetManager, createTokenCounter } from "./index.js";

describe("BudgetManager", () => {
  const counter = createTokenCounter();

  it("uses adaptive selection for small repos without wasting tokens", () => {
    const manager = new BudgetManager(counter);
    const items = [
      { content: "alpha ".repeat(20), score: 1 },
      { content: "beta ".repeat(20), score: 0.9 },
      { content: "gamma ".repeat(20), score: 0.2 },
      { content: "delta ".repeat(20), score: 0.1 },
    ];

    const { selected, totalTokens } = manager.selectAdaptive(items, { totalChunks: 12 });
    expect(selected.length).toBeLessThan(items.length);
    expect(totalTokens).toBeLessThan(1500);
    expect(selected.every((item) => item.score >= 0.2)).toBe(true);
  });

  it("returns undefined budget when none is configured", () => {
    const manager = new BudgetManager(counter);
    expect(manager.getBudget()).toBeUndefined();
    expect(manager.getBudget(5000)).toBe(5000);
  });
});
