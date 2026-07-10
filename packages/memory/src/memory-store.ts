import {
  type MemoryEntry,
  type MemoryQuery,
  type MemoryStore,
  type StorageAdapter,
  createId,
} from "@contextoptimizer/core";

export class SqliteMemoryStore implements MemoryStore {
  constructor(private readonly storage: StorageAdapter) {}

  async remember(entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">): Promise<MemoryEntry> {
    const existing = await this.storage.getMemory({
      category: entry.category,
      key: entry.key,
      limit: 1,
    });

    const now = Date.now();
    const record: MemoryEntry = {
      id: existing[0]?.id ?? createId("mem"),
      category: entry.category,
      key: entry.key,
      content: entry.content,
      sourceHash: entry.sourceHash,
      createdAt: existing[0]?.createdAt ?? now,
      updatedAt: now,
    };

    await this.storage.upsertMemory(record);
    return record;
  }

  async recall(query: MemoryQuery): Promise<MemoryEntry[]> {
    return this.storage.getMemory(query);
  }

  async forget(id: string): Promise<void> {
    await this.storage.deleteMemory(id);
  }

  async getProjectSummary(): Promise<string | null> {
    const entries = await this.storage.getMemory({
      category: "project_summary",
      key: "default",
      limit: 1,
    });
    return entries[0]?.content ?? null;
  }
}

export function createMemoryStore(storage: StorageAdapter): SqliteMemoryStore {
  return new SqliteMemoryStore(storage);
}
