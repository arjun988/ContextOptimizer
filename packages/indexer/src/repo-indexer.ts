import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import ignoreModule from "ignore";
import type { Ignore } from "ignore";

const createIgnore =
  (ignoreModule as unknown as { default?: () => Ignore }).default ??
  (ignoreModule as unknown as () => Ignore);
import { createAstCacheKey } from "@contextoptimizer/cache";
import {
  type FileRecord,
  type ImportRecord,
  type IndexResult,
  type Indexer,
  type ParseResult,
  type ReferenceRecord,
  type StorageAdapter,
  type Symbol,
  type SymbolQuery,
  createId,
  detectLanguage,
  hashContent,
  normalizePath,
} from "@contextoptimizer/core";
import type { CacheAdapter } from "@contextoptimizer/core";
import type { Parser } from "@contextoptimizer/core";

const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".data",
  "*.min.js",
  "*.map",
];

const MAX_FILE_SIZE = 1_000_000;

export interface RepoIndexerOptions {
  storage: StorageAdapter;
  parser: Parser;
  astCache?: CacheAdapter<ParseResult>;
  ignorePatterns?: string[];
}

export class RepoIndexer implements Indexer {
  private ig: Ignore;
  private repoPath = "";

  constructor(private readonly options: RepoIndexerOptions) {
    this.ig = createIgnore().add(DEFAULT_IGNORE);
    if (options.ignorePatterns) {
      this.ig.add(options.ignorePatterns);
    }
  }

  async index(repoPath: string, options?: { force?: boolean }): Promise<IndexResult> {
    const start = Date.now();
    this.repoPath = repoPath;

    await this.loadGitignore(repoPath);

    const stats = {
      filesIndexed: 0,
      filesSkipped: 0,
      filesRemoved: 0,
      symbolsExtracted: 0,
      durationMs: 0,
    };

    const discovered = await this.scanDirectory(repoPath);
    const existingFiles = await this.options.storage.getAllFiles();
    const existingMap = new Map(existingFiles.map((f) => [f.path, f]));
    const discoveredSet = new Set(discovered);

    for (const filePath of discovered) {
      const relativePath = normalizePath(relative(repoPath, filePath));
      const content = await readFile(filePath, "utf-8");
      const fileStat = await stat(filePath);
      const hash = hashContent(content);
      const existing = existingMap.get(relativePath);

      if (!options?.force && existing && existing.hash === hash) {
        stats.filesSkipped++;
        continue;
      }

      const language = detectLanguage(filePath);
      if (language === "unknown" || !this.options.parser.canParse(language)) {
        stats.filesSkipped++;
        continue;
      }

      const parseResult = await this.parseFile(relativePath, content, language, hash);
      const fileId = existing?.id ?? createId("file");

      const fileRecord: FileRecord = {
        id: fileId,
        path: relativePath,
        hash,
        size: fileStat.size,
        language: language as FileRecord["language"],
        mtime: fileStat.mtimeMs,
        indexedAt: Date.now(),
      };

      await this.options.storage.upsertFile(fileRecord);
      await this.options.storage.deleteSymbolsByFile(relativePath);
      await this.options.storage.deleteImportsByFile(relativePath);
      await this.options.storage.deleteReferencesByFile(relativePath);
      await this.options.storage.deleteChunksByFile(relativePath);

      await this.options.storage.upsertSymbols(parseResult.symbols);
      await this.options.storage.upsertImports(
        parseResult.imports.map((imp) => ({
          ...imp,
          id: createId("imp"),
          fileId,
        })),
      );
      await this.options.storage.upsertReferences(
        parseResult.references.map((ref) => ({
          ...ref,
          id: createId("ref"),
        })),
      );
      await this.options.storage.upsertChunks(parseResult.chunks);

      stats.filesIndexed++;
      stats.symbolsExtracted += parseResult.symbols.length;
    }

    for (const existing of existingFiles) {
      if (!discoveredSet.has(join(repoPath, existing.path))) {
        await this.options.storage.deleteFile(existing.path);
        await this.options.storage.deleteSymbolsByFile(existing.path);
        await this.options.storage.deleteImportsByFile(existing.path);
        await this.options.storage.deleteReferencesByFile(existing.path);
        await this.options.storage.deleteChunksByFile(existing.path);
        stats.filesRemoved++;
      }
    }

    stats.durationMs = Date.now() - start;

    return { stats, repoPath };
  }

  async getSymbols(query: SymbolQuery): Promise<Symbol[]> {
    return this.options.storage.getSymbols(query);
  }

  async getFile(path: string): Promise<FileRecord | null> {
    return this.options.storage.getFile(normalizePath(path));
  }

  private async parseFile(
    filePath: string,
    content: string,
    language: string,
    hash: string,
  ): Promise<ParseResult> {
    if (this.options.astCache) {
      const cacheKey = createAstCacheKey(hash);
      const cached = await this.options.astCache.get(cacheKey);
      if (cached) return cached;
      const result = this.options.parser.parse(filePath, content, language);
      await this.options.astCache.set(cacheKey, result);
      return result;
    }
    return this.options.parser.parse(filePath, content, language);
  }

  private async loadGitignore(repoPath: string): Promise<void> {
    try {
      const gitignorePath = join(repoPath, ".gitignore");
      const content = await readFile(gitignorePath, "utf-8");
      this.ig.add(content);
    } catch {
      // no .gitignore
    }
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    const results: string[] = [];

    async function walk(current: string, ig: Ignore, root: string): Promise<void> {
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(current, entry.name);
        const rel = normalizePath(relative(root, fullPath));

        if (ig.ignores(rel)) continue;

        if (entry.isDirectory()) {
          await walk(fullPath, ig, root);
        } else if (entry.isFile()) {
          const fileStat = await stat(fullPath);
          if (fileStat.size <= MAX_FILE_SIZE) {
            results.push(fullPath);
          }
        }
      }
    }

    await walk(dir, this.ig, dir);
    return results;
  }
}

export function createIndexer(options: RepoIndexerOptions): RepoIndexer {
  return new RepoIndexer(options);
}
