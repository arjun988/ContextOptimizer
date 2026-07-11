import type {
  Chunk,
  ChunkMetadata,
  FileRecord,
  GraphEdge,
  GraphNeighbor,
  GraphNode,
  ImportRecord,
  MemoryEntry,
  MemoryQuery,
  NeighborQuery,
  ReferenceRecord,
  StorageAdapter,
  SupportedLanguage,
  Symbol,
  SymbolKind,
  SymbolQuery,
} from "@contextoptimizer/core";
import { StorageError } from "@contextoptimizer/core";
import type { Pool, PoolClient } from "pg";
import { Pool as PgPool } from "pg";
import { PG_MIGRATIONS } from "./migrations.js";

export interface PostgresStorageOptions {
  connectionString: string;
  pool?: Pool;
}

export class PostgresStorage implements StorageAdapter {
  private pool: Pool;
  private ownsPool: boolean;

  constructor(private readonly options: PostgresStorageOptions) {
    if (options.pool) {
      this.pool = options.pool;
      this.ownsPool = false;
    } else {
      this.pool = new PgPool({ connectionString: options.connectionString });
      this.ownsPool = true;
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at BIGINT NOT NULL
        );
      `);

      for (const migration of PG_MIGRATIONS) {
        const applied = await client.query(
          "SELECT version FROM schema_migrations WHERE version = $1",
          [migration.version],
        );
        if (applied.rowCount === 0) {
          await client.query(migration.sql);
          await client.query(
            "INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)",
            [migration.version, Date.now()],
          );
        }
      }
    } catch (error) {
      throw new StorageError("Failed to initialize Postgres database", error);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.ownsPool) await this.pool.end();
  }

  async upsertFile(file: FileRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO files (id, path, hash, size, language, mtime, indexed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(path) DO UPDATE SET
         hash = EXCLUDED.hash,
         size = EXCLUDED.size,
         language = EXCLUDED.language,
         mtime = EXCLUDED.mtime,
         indexed_at = EXCLUDED.indexed_at`,
      [file.id, file.path, file.hash, file.size, file.language, file.mtime, file.indexedAt],
    );
  }

  async getFile(path: string): Promise<FileRecord | null> {
    const result = await this.pool.query("SELECT * FROM files WHERE path = $1", [path]);
    return result.rows[0] ? this.mapFile(result.rows[0]) : null;
  }

  async getAllFiles(): Promise<FileRecord[]> {
    const result = await this.pool.query("SELECT * FROM files");
    return result.rows.map((r) => this.mapFile(r));
  }

  async deleteFile(path: string): Promise<void> {
    await this.pool.query("DELETE FROM files WHERE path = $1", [path]);
  }

  async upsertSymbols(symbols: Symbol[]): Promise<void> {
    await this.withTransaction(async (client) => {
      for (const s of symbols) {
        await client.query(
          `INSERT INTO symbols (id, name, kind, file_path, start_line, end_line, start_column, end_column, signature, documentation, parent_id, language, exported)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT(id) DO UPDATE SET
             name = EXCLUDED.name, kind = EXCLUDED.kind, file_path = EXCLUDED.file_path,
             start_line = EXCLUDED.start_line, end_line = EXCLUDED.end_line,
             start_column = EXCLUDED.start_column, end_column = EXCLUDED.end_column,
             signature = EXCLUDED.signature, documentation = EXCLUDED.documentation,
             parent_id = EXCLUDED.parent_id, language = EXCLUDED.language, exported = EXCLUDED.exported`,
          [
            s.id,
            s.name,
            s.kind,
            s.filePath,
            s.startLine,
            s.endLine,
            s.startColumn,
            s.endColumn,
            s.signature ?? null,
            s.documentation ?? null,
            s.parentId ?? null,
            s.language,
            s.exported,
          ],
        );
      }
    });
  }

  async deleteSymbolsByFile(filePath: string): Promise<void> {
    await this.pool.query("DELETE FROM symbols WHERE file_path = $1", [filePath]);
  }

  async getSymbols(query: SymbolQuery): Promise<Symbol[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.name) {
      conditions.push(`name ILIKE $${idx++}`);
      params.push(`%${query.name}%`);
    }
    if (query.kind) {
      conditions.push(`kind = $${idx++}`);
      params.push(query.kind);
    }
    if (query.filePath) {
      conditions.push(`file_path = $${idx++}`);
      params.push(query.filePath);
    }
    if (query.language) {
      conditions.push(`language = $${idx++}`);
      params.push(query.language);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const result = await this.pool.query(
      `SELECT * FROM symbols ${where} ORDER BY name LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    );
    return result.rows.map((r) => this.mapSymbol(r));
  }

  async getSymbolById(id: string): Promise<Symbol | null> {
    const result = await this.pool.query("SELECT * FROM symbols WHERE id = $1", [id]);
    return result.rows[0] ? this.mapSymbol(result.rows[0]) : null;
  }

  async upsertImports(imports: ImportRecord[]): Promise<void> {
    await this.withTransaction(async (client) => {
      for (const imp of imports) {
        await client.query(
          `INSERT INTO imports (id, file_id, file_path, source, imported_names, is_default, line)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT(id) DO UPDATE SET
             file_id = EXCLUDED.file_id, file_path = EXCLUDED.file_path,
             source = EXCLUDED.source, imported_names = EXCLUDED.imported_names,
             is_default = EXCLUDED.is_default, line = EXCLUDED.line`,
          [
            imp.id,
            imp.fileId,
            imp.filePath,
            imp.source,
            JSON.stringify(imp.importedNames),
            imp.isDefault,
            imp.line,
          ],
        );
      }
    });
  }

  async deleteImportsByFile(filePath: string): Promise<void> {
    await this.pool.query("DELETE FROM imports WHERE file_path = $1", [filePath]);
  }

  async getImports(filePath?: string): Promise<ImportRecord[]> {
    const result = filePath
      ? await this.pool.query("SELECT * FROM imports WHERE file_path = $1", [filePath])
      : await this.pool.query("SELECT * FROM imports");
    return result.rows.map((r) => this.mapImport(r));
  }

  async upsertReferences(references: ReferenceRecord[]): Promise<void> {
    await this.withTransaction(async (client) => {
      for (const ref of references) {
        await client.query(
          `INSERT INTO references_table (id, from_symbol_id, to_symbol_id, to_name, kind, file_path, line)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT(id) DO UPDATE SET
             from_symbol_id = EXCLUDED.from_symbol_id, to_symbol_id = EXCLUDED.to_symbol_id,
             to_name = EXCLUDED.to_name, kind = EXCLUDED.kind,
             file_path = EXCLUDED.file_path, line = EXCLUDED.line`,
          [
            ref.id,
            ref.fromSymbolId,
            ref.toSymbolId ?? null,
            ref.toName,
            ref.kind,
            ref.filePath,
            ref.line,
          ],
        );
      }
    });
  }

  async deleteReferencesByFile(filePath: string): Promise<void> {
    await this.pool.query("DELETE FROM references_table WHERE file_path = $1", [filePath]);
  }

  async getReferences(symbolId?: string): Promise<ReferenceRecord[]> {
    const result = symbolId
      ? await this.pool.query(
          "SELECT * FROM references_table WHERE from_symbol_id = $1 OR to_symbol_id = $1",
          [symbolId],
        )
      : await this.pool.query("SELECT * FROM references_table");
    return result.rows.map((r) => this.mapReference(r));
  }

  async upsertChunks(chunks: Chunk[]): Promise<void> {
    await this.withTransaction(async (client) => {
      for (const chunk of chunks) {
        await client.query(
          `INSERT INTO chunks (id, symbol_id, file_path, content, hash, language, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT(id) DO UPDATE SET
             symbol_id = EXCLUDED.symbol_id, file_path = EXCLUDED.file_path,
             content = EXCLUDED.content, hash = EXCLUDED.hash,
             language = EXCLUDED.language, metadata = EXCLUDED.metadata`,
          [
            chunk.id,
            chunk.symbolId ?? null,
            chunk.filePath,
            chunk.content,
            chunk.hash,
            chunk.language,
            JSON.stringify(chunk.metadata),
          ],
        );
      }
    });
  }

  async deleteChunksByFile(filePath: string): Promise<void> {
    await this.pool.query("DELETE FROM chunks WHERE file_path = $1", [filePath]);
  }

  async getChunks(filePath?: string): Promise<Chunk[]> {
    const result = filePath
      ? await this.pool.query("SELECT * FROM chunks WHERE file_path = $1", [filePath])
      : await this.pool.query("SELECT * FROM chunks");
    return result.rows.map((r) => this.mapChunk(r));
  }

  async getChunkById(id: string): Promise<Chunk | null> {
    const result = await this.pool.query("SELECT * FROM chunks WHERE id = $1", [id]);
    return result.rows[0] ? this.mapChunk(result.rows[0]) : null;
  }

  async upsertGraphNodes(nodes: GraphNode[]): Promise<void> {
    await this.withTransaction(async (client) => {
      for (const node of nodes) {
        await client.query(
          `INSERT INTO graph_nodes (id, kind, name, file_path, symbol_kind)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT(id) DO UPDATE SET
             kind = EXCLUDED.kind, name = EXCLUDED.name,
             file_path = EXCLUDED.file_path, symbol_kind = EXCLUDED.symbol_kind`,
          [node.id, node.kind, node.name, node.filePath ?? null, node.symbolKind ?? null],
        );
      }
    });
  }

  async upsertGraphEdges(edges: GraphEdge[]): Promise<void> {
    await this.withTransaction(async (client) => {
      for (const edge of edges) {
        await client.query(
          `INSERT INTO graph_edges (id, from_id, to_id, kind, weight)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT(id) DO UPDATE SET
             from_id = EXCLUDED.from_id, to_id = EXCLUDED.to_id,
             kind = EXCLUDED.kind, weight = EXCLUDED.weight`,
          [edge.id, edge.fromId, edge.toId, edge.kind, edge.weight ?? null],
        );
      }
    });
  }

  async deleteGraphByFile(filePath: string): Promise<void> {
    await this.withTransaction(async (client) => {
      const nodes = await client.query("SELECT id FROM graph_nodes WHERE file_path = $1", [
        filePath,
      ]);
      for (const row of nodes.rows) {
        const id = row.id as string;
        await client.query("DELETE FROM graph_edges WHERE from_id = $1 OR to_id = $1", [id]);
        await client.query("DELETE FROM graph_nodes WHERE id = $1", [id]);
      }
    });
  }

  async getGraphNode(id: string): Promise<GraphNode | null> {
    const result = await this.pool.query("SELECT * FROM graph_nodes WHERE id = $1", [id]);
    return result.rows[0] ? this.mapGraphNode(result.rows[0]) : null;
  }

  async getGraphNeighbors(query: NeighborQuery): Promise<GraphNeighbor[]> {
    const depth = query.depth ?? 1;
    const edgeKinds = query.edgeKinds;
    const limit = query.limit ?? 100;
    const visited = new Set<string>();
    const results: GraphNeighbor[] = [];
    let frontier = [query.nodeId];
    visited.add(query.nodeId);

    for (let d = 1; d <= depth && results.length < limit; d++) {
      const nextFrontier: string[] = [];

      for (const nodeId of frontier) {
        let edgeQuery = "SELECT * FROM graph_edges WHERE from_id = $1 OR to_id = $1";
        const params: unknown[] = [nodeId];

        if (edgeKinds && edgeKinds.length > 0) {
          const placeholders = edgeKinds.map((_, i) => `$${i + 2}`).join(",");
          edgeQuery += ` AND kind IN (${placeholders})`;
          params.push(...edgeKinds);
        }

        const edges = await this.pool.query(edgeQuery, params);

        for (const edgeRow of edges.rows) {
          const edge = this.mapGraphEdge(edgeRow);
          const neighborId = edge.fromId === nodeId ? edge.toId : edge.fromId;
          if (visited.has(neighborId)) continue;
          visited.add(neighborId);

          const nodeResult = await this.pool.query("SELECT * FROM graph_nodes WHERE id = $1", [
            neighborId,
          ]);
          if (!nodeResult.rows[0]) continue;

          results.push({
            node: this.mapGraphNode(nodeResult.rows[0]),
            edge,
            distance: d,
          });

          nextFrontier.push(neighborId);
          if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
      }
      frontier = nextFrontier;
    }

    return results;
  }

  async getNodeInDegree(nodeId: string): Promise<number> {
    const result = await this.pool.query(
      "SELECT COUNT(*)::int AS count FROM graph_edges WHERE to_id = $1",
      [nodeId],
    );
    return (result.rows[0]?.count as number) ?? 0;
  }

  async upsertMemory(entry: MemoryEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO memory_entries (id, category, key, content, source_hash, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(id) DO UPDATE SET
         category = EXCLUDED.category, key = EXCLUDED.key, content = EXCLUDED.content,
         source_hash = EXCLUDED.source_hash, updated_at = EXCLUDED.updated_at`,
      [
        entry.id,
        entry.category,
        entry.key,
        entry.content,
        entry.sourceHash ?? null,
        entry.createdAt,
        entry.updatedAt,
      ],
    );
  }

  async getMemory(query: MemoryQuery): Promise<MemoryEntry[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.category) {
      conditions.push(`category = $${idx++}`);
      params.push(query.category);
    }
    if (query.key) {
      conditions.push(`key = $${idx++}`);
      params.push(query.key);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = query.limit ?? 100;

    const result = await this.pool.query(
      `SELECT * FROM memory_entries ${where} ORDER BY updated_at DESC LIMIT $${idx}`,
      [...params, limit],
    );
    return result.rows.map((r) => this.mapMemory(r));
  }

  async deleteMemory(id: string): Promise<void> {
    await this.pool.query("DELETE FROM memory_entries WHERE id = $1", [id]);
  }

  private async withTransaction(fn: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await fn(client);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private mapMemory(row: Record<string, unknown>): MemoryEntry {
    return {
      id: row.id as string,
      category: row.category as MemoryEntry["category"],
      key: row.key as string,
      content: row.content as string,
      sourceHash: (row.source_hash as string) ?? undefined,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  private mapFile(row: Record<string, unknown>): FileRecord {
    return {
      id: row.id as string,
      path: row.path as string,
      hash: row.hash as string,
      size: Number(row.size),
      language: row.language as SupportedLanguage | "unknown",
      mtime: Number(row.mtime),
      indexedAt: Number(row.indexed_at),
    };
  }

  private mapSymbol(row: Record<string, unknown>): Symbol {
    return {
      id: row.id as string,
      name: row.name as string,
      kind: row.kind as SymbolKind,
      filePath: row.file_path as string,
      startLine: Number(row.start_line),
      endLine: Number(row.end_line),
      startColumn: Number(row.start_column),
      endColumn: Number(row.end_column),
      signature: (row.signature as string) ?? undefined,
      documentation: (row.documentation as string) ?? undefined,
      parentId: (row.parent_id as string) ?? undefined,
      language: row.language as SupportedLanguage,
      exported: Boolean(row.exported),
    };
  }

  private mapImport(row: Record<string, unknown>): ImportRecord {
    const names = row.imported_names;
    return {
      id: row.id as string,
      fileId: row.file_id as string,
      filePath: row.file_path as string,
      source: row.source as string,
      importedNames: (typeof names === "string" ? JSON.parse(names) : names) as string[],
      isDefault: Boolean(row.is_default),
      line: Number(row.line),
    };
  }

  private mapReference(row: Record<string, unknown>): ReferenceRecord {
    return {
      id: row.id as string,
      fromSymbolId: row.from_symbol_id as string,
      toSymbolId: (row.to_symbol_id as string) ?? undefined,
      toName: row.to_name as string,
      kind: row.kind as ReferenceRecord["kind"],
      filePath: row.file_path as string,
      line: Number(row.line),
    };
  }

  private mapChunk(row: Record<string, unknown>): Chunk {
    const metadata = row.metadata;
    return {
      id: row.id as string,
      symbolId: (row.symbol_id as string) ?? undefined,
      filePath: row.file_path as string,
      content: row.content as string,
      hash: row.hash as string,
      language: row.language as SupportedLanguage | "unknown",
      metadata: (typeof metadata === "string" ? JSON.parse(metadata) : metadata) as ChunkMetadata,
    };
  }

  private mapGraphNode(row: Record<string, unknown>): GraphNode {
    return {
      id: row.id as string,
      kind: row.kind as GraphNode["kind"],
      name: row.name as string,
      filePath: (row.file_path as string) ?? undefined,
      symbolKind: (row.symbol_kind as SymbolKind) ?? undefined,
    };
  }

  private mapGraphEdge(row: Record<string, unknown>): GraphEdge {
    return {
      id: row.id as string,
      fromId: row.from_id as string,
      toId: row.to_id as string,
      kind: row.kind as GraphEdge["kind"],
      weight: row.weight != null ? Number(row.weight) : undefined,
    };
  }
}

export function createPostgresStorage(connectionString: string, pool?: Pool): PostgresStorage {
  return new PostgresStorage({ connectionString, pool });
}
