import type { Chunk, ChunkMetadata, ParseResult, Symbol, SymbolKind } from "@contextoptimizer/core";
import { createId, hashContent } from "@contextoptimizer/core";

export interface ExtractorContext {
  filePath: string;
  language: string;
  content: string;
  source: string;
}

export function createChunk(ctx: ExtractorContext, symbol: Symbol, header?: string): Chunk {
  const lines = ctx.content.split("\n");
  const symbolLines = lines.slice(symbol.startLine, symbol.endLine + 1);
  const body = symbolLines.join("\n");
  const content = header ? `${header}\n${body}` : body;

  const metadata: ChunkMetadata = {
    symbolName: symbol.name,
    symbolKind: symbol.kind,
    signature: symbol.signature,
    startLine: symbol.startLine,
    endLine: symbol.endLine,
  };

  if (symbol.parentId) {
    metadata.enclosingClass = symbol.parentId;
  }

  return {
    id: createId("chunk"),
    symbolId: symbol.id,
    filePath: ctx.filePath,
    content,
    hash: hashContent(content),
    language: symbol.language,
    metadata,
  };
}

export function nodeText(ctx: ExtractorContext, startIndex: number, endIndex: number): string {
  return ctx.source.slice(startIndex, endIndex);
}

export function nodeLine(node: { startPosition: { row: number } }): number {
  return node.startPosition.row;
}

export function isExported(node: { parent: unknown | null }): boolean {
  let current = node.parent as { type?: string; parent?: unknown | null } | null;
  while (current) {
    if (current.type === "export_statement" || current.type === "export_declaration") {
      return true;
    }
    current = (current.parent as { type?: string; parent?: unknown | null } | null) ?? null;
  }
  return false;
}

export const SYMBOL_NODE_TYPES: Record<string, SymbolKind> = {
  class_declaration: "class",
  class_definition: "class",
  function_declaration: "function",
  function_definition: "function",
  method_definition: "method",
  method_declaration: "method",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
  struct_item: "struct",
  impl_item: "class",
  function_item: "function",
  class_specifier: "class",
};

export function kindFromNodeType(type: string): SymbolKind {
  return SYMBOL_NODE_TYPES[type] ?? "variable";
}
