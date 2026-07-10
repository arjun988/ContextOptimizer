export const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        language TEXT NOT NULL,
        mtime INTEGER NOT NULL,
        indexed_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        start_column INTEGER NOT NULL,
        end_column INTEGER NOT NULL,
        signature TEXT,
        documentation TEXT,
        parent_id TEXT,
        language TEXT NOT NULL,
        exported INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path);
      CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);

      CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        source TEXT NOT NULL,
        imported_names TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        line INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_imports_file ON imports(file_path);
      CREATE INDEX IF NOT EXISTS idx_imports_source ON imports(source);

      CREATE TABLE IF NOT EXISTS references_table (
        id TEXT PRIMARY KEY,
        from_symbol_id TEXT NOT NULL,
        to_symbol_id TEXT,
        to_name TEXT NOT NULL,
        kind TEXT NOT NULL,
        file_path TEXT NOT NULL,
        line INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_refs_from ON references_table(from_symbol_id);
      CREATE INDEX IF NOT EXISTS idx_refs_to ON references_table(to_symbol_id);
      CREATE INDEX IF NOT EXISTS idx_refs_file ON references_table(file_path);

      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        symbol_id TEXT,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        hash TEXT NOT NULL,
        language TEXT NOT NULL,
        metadata TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_path);
      CREATE INDEX IF NOT EXISTS idx_chunks_symbol ON chunks(symbol_id);

      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        file_path TEXT,
        symbol_kind TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_graph_nodes_file ON graph_nodes(file_path);

      CREATE TABLE IF NOT EXISTS graph_edges (
        id TEXT PRIMARY KEY,
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        weight REAL
      );
      CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges(from_id);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_to ON graph_edges(to_id);
      CREATE INDEX IF NOT EXISTS idx_graph_edges_kind ON graph_edges(kind);
    `,
  },
];
