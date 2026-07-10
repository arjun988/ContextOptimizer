import { describe, expect, it } from "vitest";
import { MemoryCache } from "./memory-cache.js";

describe("MemoryCache", () => {
  it("stores and retrieves values", async () => {
    const cache = new MemoryCache<string>();
    await cache.set("key", "value");
    expect(await cache.get("key")).toBe("value");
  });

  it("expires values after ttl", async () => {
    const cache = new MemoryCache<string>();
    await cache.set("key", "value", 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(await cache.get("key")).toBeNull();
  });
});
