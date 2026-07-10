import { type VectorStore, cosineSimilarity } from "@contextoptimizer/core";

interface StoredVector {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export class InMemoryVectorStore implements VectorStore {
  readonly name = "in-memory";
  private items = new Map<string, StoredVector>();

  async initialize(): Promise<void> {}

  async close(): Promise<void> {
    this.items.clear();
  }

  async upsert(
    items: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }>,
  ): Promise<void> {
    for (const item of items) {
      this.items.set(item.id, item);
    }
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.items.delete(id);
    }
  }

  async search(
    vector: number[],
    limit: number,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
    const results: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];

    for (const item of this.items.values()) {
      if (filter && !matchesFilter(item.metadata, filter)) continue;
      results.push({
        id: item.id,
        score: cosineSimilarity(vector, item.vector),
        metadata: item.metadata,
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async count(): Promise<number> {
    return this.items.size;
  }
}

function matchesFilter(
  metadata: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (metadata[key] !== value) return false;
  }
  return true;
}

export interface LanceDbVectorStoreOptions {
  dbPath: string;
  tableName?: string;
}

export class LanceDbVectorStore implements VectorStore {
  readonly name = "lancedb";
  private table: {
    add: (rows: unknown[]) => Promise<void>;
    search: (v: number[]) => { limit: (n: number) => { toArray: () => Promise<unknown[]> } };
  } | null = null;
  private db: {
    openTable: (name: string) => Promise<unknown>;
    createTable: (name: string, data: unknown[]) => Promise<unknown>;
  } | null = null;
  private readonly tableName: string;

  constructor(private readonly options: LanceDbVectorStoreOptions) {
    this.tableName = options.tableName ?? "chunks";
  }

  async initialize(): Promise<void> {
    const lancedb = await import("@lancedb/lancedb");
    this.db = (await lancedb.connect(this.options.dbPath)) as typeof this.db;

    try {
      this.table = (await this.db!.openTable(this.tableName)) as typeof this.table;
    } catch {
      this.table = (await this.db!.createTable(this.tableName, [
        { id: "__init__", vector: [0], metadata: "{}" },
      ])) as typeof this.table;
    }
  }

  async close(): Promise<void> {
    this.table = null;
    this.db = null;
  }

  async upsert(
    items: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }>,
  ): Promise<void> {
    if (!this.table) throw new Error("LanceDB not initialized");
    await this.table.add(
      items.map((item) => ({
        id: item.id,
        vector: item.vector,
        metadata: JSON.stringify(item.metadata),
      })),
    );
  }

  async delete(_ids: string[]): Promise<void> {
    // LanceDB delete requires version-specific API; noop for initial impl
  }

  async search(
    vector: number[],
    limit: number,
    _filter?: Record<string, unknown>,
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
    if (!this.table) throw new Error("LanceDB not initialized");
    const rows = await this.table.search(vector).limit(limit).toArray();
    return (rows as Array<{ id: string; _distance: number; metadata: string }>).map((row) => ({
      id: row.id,
      score: 1 - (row._distance ?? 0),
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    }));
  }

  async count(): Promise<number> {
    return 0;
  }
}

export function createInMemoryVectorStore(): InMemoryVectorStore {
  return new InMemoryVectorStore();
}

export function createLanceDbVectorStore(options: LanceDbVectorStoreOptions): LanceDbVectorStore {
  return new LanceDbVectorStore(options);
}
