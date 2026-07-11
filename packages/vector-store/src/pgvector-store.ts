import { type VectorStore, cosineSimilarity } from "@contextoptimizer/core";
import { Pool as PgPool, type Pool } from "pg";

export interface PgVectorStoreOptions {
  connectionString?: string;
  pool?: Pool;
  tableName?: string;
  dimensions?: number;
}

export class PgVectorStore implements VectorStore {
  readonly name = "pgvector";
  private pool: Pool;
  private ownsPool: boolean;
  private readonly tableName: string;
  private readonly dimensions: number;

  constructor(private readonly options: PgVectorStoreOptions) {
    this.tableName = options.tableName ?? "chunk_vectors";
    this.dimensions = options.dimensions ?? 384;

    if (options.pool) {
      this.pool = options.pool;
      this.ownsPool = false;
    } else if (options.connectionString) {
      this.pool = new PgPool({ connectionString: options.connectionString });
      this.ownsPool = true;
    } else {
      throw new Error("PgVectorStore requires connectionString or pool");
    }
  }

  async initialize(): Promise<void> {
    await this.pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        vector vector(${this.dimensions}) NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'
      )
    `);
    try {
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_vector
        ON ${this.tableName} USING ivfflat (vector vector_cosine_ops)
      `);
    } catch {
      // IVFFlat requires rows; index can be created after first upsert
    }
  }

  async close(): Promise<void> {
    if (this.ownsPool) await this.pool.end();
  }

  async upsert(
    items: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }>,
  ): Promise<void> {
    for (const item of items) {
      const vectorLiteral = `[${item.vector.join(",")}]`;
      await this.pool.query(
        `INSERT INTO ${this.tableName} (id, vector, metadata)
         VALUES ($1, $2::vector, $3)
         ON CONFLICT(id) DO UPDATE SET vector = EXCLUDED.vector, metadata = EXCLUDED.metadata`,
        [item.id, vectorLiteral, JSON.stringify(item.metadata)],
      );
    }
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.pool.query(`DELETE FROM ${this.tableName} WHERE id = ANY($1)`, [ids]);
  }

  async search(
    vector: number[],
    limit: number,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
    const vectorLiteral = `[${vector.join(",")}]`;
    const conditions: string[] = [];
    const params: unknown[] = [vectorLiteral, limit];
    let idx = 3;

    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        conditions.push(`metadata->>$${idx++} = $${idx++}`);
        params.push(key, String(value));
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const result = await this.pool.query(
        `SELECT id, metadata, 1 - (vector <=> $1::vector) AS score
         FROM ${this.tableName}
         ${where}
         ORDER BY vector <=> $1::vector
         LIMIT $2`,
        params,
      );
      return result.rows.map((row) => ({
        id: row.id as string,
        score: Number(row.score),
        metadata: (typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata) as Record<string, unknown>,
      }));
    } catch {
      return this.fallbackSearch(vector, limit, filter);
    }
  }

  private async fallbackSearch(
    vector: number[],
    limit: number,
    filter?: Record<string, unknown>,
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
    const result = await this.pool.query(`SELECT id, vector::text, metadata FROM ${this.tableName}`);
    const scored: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];

    for (const row of result.rows) {
      const metadata = (typeof row.metadata === "string"
        ? JSON.parse(row.metadata)
        : row.metadata) as Record<string, unknown>;
      if (filter && !matchesFilter(metadata, filter)) continue;

      const stored = parsePgVector(row.vector as string);
      scored.push({
        id: row.id as string,
        score: cosineSimilarity(vector, stored),
        metadata,
      });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async count(): Promise<number> {
    const result = await this.pool.query(`SELECT COUNT(*)::int AS count FROM ${this.tableName}`);
    return (result.rows[0]?.count as number) ?? 0;
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

function parsePgVector(text: string): number[] {
  return text
    .replace(/[\[\]]/g, "")
    .split(",")
    .map((v) => Number.parseFloat(v.trim()));
}

export function createPgVectorStore(options: PgVectorStoreOptions): PgVectorStore {
  return new PgVectorStore(options);
}
