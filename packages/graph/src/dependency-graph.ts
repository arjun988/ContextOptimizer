import { extname, join } from "node:path";
import {
  type GraphEdge,
  type GraphNeighbor,
  type GraphNode,
  type GraphService,
  type ImportRecord,
  type NeighborQuery,
  type ReferenceRecord,
  type StorageAdapter,
  type Symbol,
  createId,
  normalizePath,
} from "@contextoptimizer/core";

const EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
];

export interface DependencyGraphOptions {
  storage: StorageAdapter;
  repoPath: string;
}

export class DependencyGraph implements GraphService {
  constructor(private readonly options: DependencyGraphOptions) {}

  async buildForFile(filePath: string): Promise<void> {
    const normalized = normalizePath(filePath);
    await this.options.storage.deleteGraphByFile(normalized);

    const symbols = await this.options.storage.getSymbols({ filePath: normalized });
    const imports = await this.options.storage.getImports(normalized);
    const references = await this.options.storage.getReferences();

    const nodes: GraphNode[] = [
      {
        id: this.fileNodeId(normalized),
        kind: "file",
        name: normalized,
        filePath: normalized,
      },
    ];

    const edges: GraphEdge[] = [];

    for (const symbol of symbols) {
      nodes.push({
        id: symbol.id,
        kind: "symbol",
        name: symbol.name,
        filePath: normalized,
        symbolKind: symbol.kind,
      });

      edges.push({
        id: createId("edge"),
        fromId: this.fileNodeId(normalized),
        toId: symbol.id,
        kind: "contains",
      });
    }

    for (const imp of imports) {
      const targetFile = await this.resolveImportPath(normalized, imp);
      if (targetFile) {
        const targetNodeId = this.fileNodeId(targetFile);
        nodes.push({
          id: targetNodeId,
          kind: "file",
          name: targetFile,
          filePath: targetFile,
        });
        edges.push({
          id: createId("edge"),
          fromId: this.fileNodeId(normalized),
          toId: targetNodeId,
          kind: "imports",
        });

        for (const name of imp.importedNames) {
          const resolved = await this.resolveImport(targetFile, name);
          if (resolved) {
            edges.push({
              id: createId("edge"),
              fromId: this.fileNodeId(normalized),
              toId: resolved.id,
              kind: "imports",
            });
          }
        }
      }
    }

    const fileSymbolIds = new Set(symbols.map((s) => s.id));
    const fileRefs = references.filter(
      (r) => r.filePath === normalized || fileSymbolIds.has(r.fromSymbolId),
    );

    for (const ref of fileRefs) {
      const fromId = ref.fromSymbolId;
      let toId = ref.toSymbolId;

      if (!toId) {
        const resolved = await this.resolveSymbolByName(ref.toName, normalized);
        toId = resolved?.id;
      }

      if (toId) {
        edges.push({
          id: createId("edge"),
          fromId,
          toId,
          kind: ref.kind === "call" ? "calls" : "references",
        });
      }
    }

    await this.options.storage.upsertGraphNodes(this.dedupeNodes(nodes));
    await this.options.storage.upsertGraphEdges(edges);
  }

  async rebuild(): Promise<void> {
    const files = await this.options.storage.getAllFiles();
    for (const file of files) {
      await this.buildForFile(file.path);
    }
  }

  async neighbors(query: NeighborQuery): Promise<GraphNeighbor[]> {
    return this.options.storage.getGraphNeighbors(query);
  }

  async resolveImport(filePath: string, importedName: string): Promise<Symbol | null> {
    const symbols = await this.options.storage.getSymbols({
      filePath,
      name: importedName,
      limit: 5,
    });
    return symbols.find((s) => s.name === importedName) ?? symbols[0] ?? null;
  }

  async getPopularityScores(symbolIds: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    for (const id of symbolIds) {
      const inDegree = await this.options.storage.getNodeInDegree(id);
      scores.set(id, Math.log1p(inDegree));
    }
    return scores;
  }

  private async resolveImportPath(fromFile: string, imp: ImportRecord): Promise<string | null> {
    const source = imp.source;
    if (source.startsWith(".")) {
      const dir = fromFile.split("/").slice(0, -1);
      const parts = source.split("/");
      for (const part of parts) {
        if (part === ".") continue;
        if (part === "..") dir.pop();
        else dir.push(part);
      }

      for (const ext of EXTENSIONS) {
        const candidate = normalizePath(join(...dir)) + ext;
        const file = await this.options.storage.getFile(candidate);
        if (file) return candidate;
      }

      for (const ext of EXTENSIONS) {
        const candidate = normalizePath(join(...dir, "index")) + ext;
        const file = await this.options.storage.getFile(candidate);
        if (file) return candidate;
      }
    }

    const byName = await this.options.storage.getSymbols({
      name: source.split("/").pop(),
      limit: 1,
    });
    return byName[0]?.filePath ?? null;
  }

  private async resolveSymbolByName(name: string, nearFile: string): Promise<Symbol | null> {
    const local = await this.options.storage.getSymbols({ filePath: nearFile, name, limit: 5 });
    if (local.length > 0) return local[0] ?? null;

    const global = await this.options.storage.getSymbols({ name, limit: 10 });
    return global.find((s) => s.name === name) ?? null;
  }

  private fileNodeId(filePath: string): string {
    return `file:${normalizePath(filePath)}`;
  }

  private dedupeNodes(nodes: GraphNode[]): GraphNode[] {
    const seen = new Map<string, GraphNode>();
    for (const node of nodes) {
      seen.set(node.id, node);
    }
    return [...seen.values()];
  }
}

export function createGraph(options: DependencyGraphOptions): DependencyGraph {
  return new DependencyGraph(options);
}
