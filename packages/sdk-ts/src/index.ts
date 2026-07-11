import type {
  BudgetRequest,
  CompressRequest,
  ContextRequest,
  MemoryEntry,
  MemoryQuery,
  SearchQuery,
  SymbolQuery,
} from "@contextoptimizer/core";
import {
  type ContextOptimizerEngine,
  type EngineConfig,
  createEngine,
} from "@contextoptimizer/engine";

export interface RemoteClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export class ContextOptimizerClient {
  private engine?: ContextOptimizerEngine;
  private remote?: RemoteClientOptions;

  constructor(config: EngineConfig | RemoteClientOptions) {
    if ("baseUrl" in config) {
      this.remote = config;
    } else {
      this.engine = createEngine(config);
    }
  }

  private async fetchApi<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
    if (!this.remote) throw new Error("Remote client not configured");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.remote.apiKey) headers.Authorization = `Bearer ${this.remote.apiKey}`;
    const res = await fetch(`${this.remote.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  private async fetchText(path: string): Promise<string> {
    if (!this.remote) throw new Error("Remote client not configured");
    const headers: Record<string, string> = {};
    if (this.remote.apiKey) headers.Authorization = `Bearer ${this.remote.apiKey}`;
    const res = await fetch(`${this.remote.baseUrl}${path}`, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
    return res.text();
  }

  async initialize(): Promise<void> {
    if (this.engine) await this.engine.initialize();
  }

  async close(): Promise<void> {
    if (this.engine) await this.engine.close();
  }

  async index(options?: { force?: boolean }) {
    if (this.engine) return this.engine.index(options);
    return this.fetchApi("/index", options ?? {});
  }

  async search(query: SearchQuery) {
    if (this.engine) return this.engine.search(query);
    return this.fetchApi("/search", query);
  }

  async getContext(request: ContextRequest) {
    if (this.engine) return this.engine.getContext(request);
    return this.fetchApi("/context", request);
  }

  async compress(request: CompressRequest) {
    if (this.engine) return this.engine.compress(request);
    return this.fetchApi("/compress", request);
  }

  async getSymbols(query: SymbolQuery) {
    if (this.engine) return this.engine.getSymbols(query);
    return this.fetchApi("/symbols", query);
  }

  async remember(entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">) {
    if (this.engine) return this.engine.remember(entry);
    return this.fetchApi("/memory", { action: "remember", ...entry });
  }

  async recall(query: MemoryQuery) {
    if (this.engine) return this.engine.recall(query);
    return this.fetchApi("/memory", { action: "recall", ...query });
  }

  async neighbors(nodeId: string, depth = 1) {
    if (this.engine) return this.engine.neighbors(nodeId, depth);
    return this.fetchApi("/graph", { nodeId, depth });
  }

  async budget(request: BudgetRequest) {
    if (this.engine) return this.engine.budget(request);
    return this.fetchApi("/budget", request);
  }

  async health() {
    return this.fetchApi<{ status: string; repoPath: string }>("/health", undefined, "GET");
  }

  async metrics() {
    return this.fetchText("/metrics");
  }

  async doctor() {
    if (this.engine) return this.engine.doctor();
    return this.fetchApi("/doctor", undefined, "GET");
  }
}

export function createClient(config: EngineConfig): ContextOptimizerClient;
export function createClient(config: RemoteClientOptions): ContextOptimizerClient;
export function createClient(config: EngineConfig | RemoteClientOptions): ContextOptimizerClient {
  return new ContextOptimizerClient(config);
}

export { createEngine, type EngineConfig };
