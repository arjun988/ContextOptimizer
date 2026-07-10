import { createRequire } from "node:module";
import type {
  Chunk,
  ChunkMetadata,
  FileRecord,
  GraphEdge,
  GraphNeighbor,
  GraphNode,
  ImportRecord,
  NeighborQuery,
  ReferenceRecord,
  StorageAdapter,
  SupportedLanguage,
  Symbol,
  SymbolKind,
  SymbolQuery,
} from "@contextoptimizer/core";
import { StorageError } from "@contextoptimizer/core";
import { MIGRATIONS } from "./migrations.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");

export interface SqliteStorageOptions {
  dbPath: string;
}

export class SqliteStorage implements StorageAdapter {
  private db: InstanceType<typeof DatabaseSync>;

  constructor(private readonly options: SqliteStorageOptions) {
    this.db = new DatabaseSync(options.dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
  }

  async initialize(): Promise<void> {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );
      `);

      for (const migration of MIGRATIONS) {
        const applied = this.db
          .prepare("SELECT version FROM schema_migrations WHERE version = ?")
          .get(migration.version);
        if (!applied) {
          this.db.exec(migration.sql);
          this.db
            .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
            .run(migration.version, Date.now());
        }
      }
    } catch (error) {
      throw new StorageError("Failed to initialize database", error);
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async upsertFile(file: FileRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO files (id, path, hash, size, language, mtime, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           hash = excluded.hash,
           size = excluded.size,
           language = excluded.language,
           mtime = excluded.mtime,
           indexed_at = excluded.indexed_at`,
      )
      .run(file.id, file.path, file.hash, file.size, file.language, file.mtime, file.indexedAt);
  }

  async getFile(path: string): Promise<FileRecord | null> {
    const row = this.db.prepare("SELECT * FROM files WHERE path = ?").get(path) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapFile(row) : null;
  }

  async getAllFiles(): Promise<FileRecord[]> {
    const rows = this.db.prepare("SELECT * FROM files").all() as Record<string, unknown>[];
    return rows.map((r) => this.mapFile(r));
  }

  async deleteFile(path: string): Promise<void> {
    this.db.prepare("DELETE FROM files WHERE path = ?").run(path);
  }

  async upsertSymbols(symbols: Symbol[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO symbols (id, name, kind, file_path, start_line, end_line, start_column, end_column, signature, documentation, parent_id, language, exported)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         kind = excluded.kind,
         file_path = excluded.file_path,
         start_line = excluded.start_line,
         end_line = excluded.end_line,
         start_column = excluded.start_column,
         end_column = excluded.end_column,
         signature = excluded.signature,
         documentation = excluded.documentation,
         parent_id = excluded.parent_id,
         language = excluded.language,
         exported = excluded.exported`,
    );

    this.db.exec("BEGIN");
    try {
      for (const s of symbols) {
        stmt.run(
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
          s.exported ? 1 : 0,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async deleteSymbolsByFile(filePath: string): Promise<void> {
    this.db.prepare("DELETE FROM symbols WHERE file_path = ?").run(filePath);
  }

  async getSymbols(query: SymbolQuery): Promise<Symbol[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.name) {
      conditions.push("name LIKE ?");
      params.push(`%${query.name}%`);
    }
    if (query.kind) {
      conditions.push("kind = ?");
      params.push(query.kind);
    }
    if (query.filePath) {
      conditions.push("file_path = ?");
      params.push(query.filePath);
    }
    if (query.language) {
      conditions.push("language = ?");
      params.push(query.language);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const rows = this.db
      .prepare(`SELECT * FROM symbols ${where} ORDER BY name LIMIT ? OFFSET ?`)
      .all(...(params as (string | number | null)[]), limit, offset) as Record<string, unknown>[];

    return rows.map((r) => this.mapSymbol(r));
  }

  async getSymbolById(id: string): Promise<Symbol | null> {
    const row = this.db.prepare("SELECT * FROM symbols WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapSymbol(row) : null;
  }

  async upsertImports(imports: ImportRecord[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO imports (id, file_id, file_path, source, imported_names, is_default, line)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         file_id = excluded.file_id,
         file_path = excluded.file_path,
         source = excluded.source,
         imported_names = excluded.imported_names,
         is_default = excluded.is_default,
         line = excluded.line`,
    );

    this.db.exec("BEGIN");
    try {
      for (const imp of imports) {
        stmt.run(
          imp.id,
          imp.fileId,
          imp.filePath,
          imp.source,
          JSON.stringify(imp.importedNames),
          imp.isDefault ? 1 : 0,
          imp.line,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async deleteImportsByFile(filePath: string): Promise<void> {
    this.db.prepare("DELETE FROM imports WHERE file_path = ?").run(filePath);
  }

  async getImports(filePath?: string): Promise<ImportRecord[]> {
    const rows = filePath
      ? (this.db.prepare("SELECT * FROM imports WHERE file_path = ?").all(filePath) as Record<
          string,
          unknown
        >[])
      : (this.db.prepare("SELECT * FROM imports").all() as Record<string, unknown>[]);

    return rows.map((r) => this.mapImport(r));
  }

  async upsertReferences(references: ReferenceRecord[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO references_table (id, from_symbol_id, to_symbol_id, to_name, kind, file_path, line)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         from_symbol_id = excluded.from_symbol_id,
         to_symbol_id = excluded.to_symbol_id,
         to_name = excluded.to_name,
         kind = excluded.kind,
         file_path = excluded.file_path,
         line = excluded.line`,
    );

    this.db.exec("BEGIN");
    try {
      for (const ref of references) {
        stmt.run(
          ref.id,
          ref.fromSymbolId,
          ref.toSymbolId ?? null,
          ref.toName,
          ref.kind,
          ref.filePath,
          ref.line,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async deleteReferencesByFile(filePath: string): Promise<void> {
    this.db.prepare("DELETE FROM references_table WHERE file_path = ?").run(filePath);
  }

  async getReferences(symbolId?: string): Promise<ReferenceRecord[]> {
    const rows = symbolId
      ? (this.db
          .prepare("SELECT * FROM references_table WHERE from_symbol_id = ? OR to_symbol_id = ?")
          .all(symbolId, symbolId) as Record<string, unknown>[])
      : (this.db.prepare("SELECT * FROM references_table").all() as Record<string, unknown>[]);

    return rows.map((r) => this.mapReference(r));
  }

  async upsertChunks(chunks: Chunk[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO chunks (id, symbol_id, file_path, content, hash, language, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         symbol_id = excluded.symbol_id,
         file_path = excluded.file_path,
         content = excluded.content,
         hash = excluded.hash,
         language = excluded.language,
         metadata = excluded.metadata`,
    );

    this.db.exec("BEGIN");
    try {
      for (const chunk of chunks) {
        stmt.run(
          chunk.id,
          chunk.symbolId ?? null,
          chunk.filePath,
          chunk.content,
          chunk.hash,
          chunk.language,
          JSON.stringify(chunk.metadata),
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async deleteChunksByFile(filePath: string): Promise<void> {
    this.db.prepare("DELETE FROM chunks WHERE file_path = ?").run(filePath);
  }

  async getChunks(filePath?: string): Promise<Chunk[]> {
    const rows = filePath
      ? (this.db.prepare("SELECT * FROM chunks WHERE file_path = ?").all(filePath) as Record<
          string,
          unknown
        >[])
      : (this.db.prepare("SELECT * FROM chunks").all() as Record<string, unknown>[]);

    return rows.map((r) => this.mapChunk(r));
  }

  async getChunkById(id: string): Promise<Chunk | null> {
    const row = this.db.prepare("SELECT * FROM chunks WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapChunk(row) : null;
  }

  async upsertGraphNodes(nodes: GraphNode[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO graph_nodes (id, kind, name, file_path, symbol_kind)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         kind = excluded.kind,
         name = excluded.name,
         file_path = excluded.file_path,
         symbol_kind = excluded.symbol_kind`,
    );

    this.db.exec("BEGIN");
    try {
      for (const node of nodes) {
        stmt.run(node.id, node.kind, node.name, node.filePath ?? null, node.symbolKind ?? null);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async upsertGraphEdges(edges: GraphEdge[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO graph_edges (id, from_id, to_id, kind, weight)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         from_id = excluded.from_id,
         to_id = excluded.to_id,
         kind = excluded.kind,
         weight = excluded.weight`,
    );

    this.db.exec("BEGIN");
    try {
      for (const edge of edges) {
        stmt.run(edge.id, edge.fromId, edge.toId, edge.kind, edge.weight ?? null);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async deleteGraphByFile(filePath: string): Promise<void> {
    const nodeIds = this.db
      .prepare("SELECT id FROM graph_nodes WHERE file_path = ?")
      .all(filePath) as Array<{ id: string }>;

    this.db.exec("BEGIN");
    try {
      for (const { id } of nodeIds) {
        this.db.prepare("DELETE FROM graph_edges WHERE from_id = ? OR to_id = ?").run(id, id);
        this.db.prepare("DELETE FROM graph_nodes WHERE id = ?").run(id);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async getGraphNode(id: string): Promise<GraphNode | null> {
    const row = this.db.prepare("SELECT * FROM graph_nodes WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapGraphNode(row) : null;
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
        let edgeQuery = "SELECT * FROM graph_edges WHERE from_id = ? OR to_id = ?";
        const params: unknown[] = [nodeId, nodeId];

        if (edgeKinds && edgeKinds.length > 0) {
          edgeQuery += ` AND kind IN (${edgeKinds.map(() => "?").join(",")})`;
          params.push(...edgeKinds);
        }

        const edges = this.db
          .prepare(edgeQuery)
          .all(...(params as (string | number | null)[])) as Record<string, unknown>[];

        for (const edgeRow of edges) {
          const edge = this.mapGraphEdge(edgeRow);
          const neighborId = edge.fromId === nodeId ? edge.toId : edge.fromId;
          if (visited.has(neighborId)) continue;
          visited.add(neighborId);

          const nodeRow = this.db
            .prepare("SELECT * FROM graph_nodes WHERE id = ?")
            .get(neighborId) as Record<string, unknown> | undefined;
          if (!nodeRow) continue;

          results.push({
            node: this.mapGraphNode(nodeRow),
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
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM graph_edges WHERE to_id = ?")
      .get(nodeId) as { count: number };
    return row.count;
  }

  private mapFile(row: Record<string, unknown>): FileRecord {
    return {
      id: row.id as string,
      path: row.path as string,
      hash: row.hash as string,
      size: row.size as number,
      language: row.language as SupportedLanguage | "unknown",
      mtime: row.mtime as number,
      indexedAt: row.indexed_at as number,
    };
  }

  private mapSymbol(row: Record<string, unknown>): Symbol {
    return {
      id: row.id as string,
      name: row.name as string,
      kind: row.kind as SymbolKind,
      filePath: row.file_path as string,
      startLine: row.start_line as number,
      endLine: row.end_line as number,
      startColumn: row.start_column as number,
      endColumn: row.end_column as number,
      signature: (row.signature as string) ?? undefined,
      documentation: (row.documentation as string) ?? undefined,
      parentId: (row.parent_id as string) ?? undefined,
      language: row.language as SupportedLanguage,
      exported: Boolean(row.exported),
    };
  }

  private mapImport(row: Record<string, unknown>): ImportRecord {
    return {
      id: row.id as string,
      fileId: row.file_id as string,
      filePath: row.file_path as string,
      source: row.source as string,
      importedNames: JSON.parse(row.imported_names as string) as string[],
      isDefault: Boolean(row.is_default),
      line: row.line as number,
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
      line: row.line as number,
    };
  }

  private mapChunk(row: Record<string, unknown>): Chunk {
    return {
      id: row.id as string,
      symbolId: (row.symbol_id as string) ?? undefined,
      filePath: row.file_path as string,
      content: row.content as string,
      hash: row.hash as string,
      language: row.language as SupportedLanguage | "unknown",
      metadata: JSON.parse(row.metadata as string) as ChunkMetadata,
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
      weight: (row.weight as number) ?? undefined,
    };
  }
}

export function createSqliteStorage(dbPath: string): SqliteStorage {
  return new SqliteStorage({ dbPath });
}
