import type {
  ImportRecord,
  ParseResult,
  ReferenceRecord,
  SupportedLanguage,
  Symbol,
  SymbolKind,
} from "@contextoptimizer/core";
import { createId } from "@contextoptimizer/core";
import type { SyntaxNode } from "tree-sitter";
import { createChunk, isExported, kindFromNodeType, nodeLine, nodeText } from "./extractors.js";

export interface TreeContext {
  filePath: string;
  language: string;
  content: string;
  source: string;
  root: SyntaxNode;
}

const DEFINITION_TYPES = new Set([
  "class_declaration",
  "class_definition",
  "function_declaration",
  "function_definition",
  "method_definition",
  "method_declaration",
  "interface_declaration",
  "type_alias_declaration",
  "enum_declaration",
  "struct_item",
  "function_item",
  "impl_item",
  "class_specifier",
  "lexical_declaration",
]);

const IMPORT_TYPES = new Set(["import_statement", "import_declaration", "import_from_statement"]);

export function extractFromTree(ctx: TreeContext): ParseResult {
  const symbols: Symbol[] = [];
  const imports: Omit<ImportRecord, "id" | "fileId">[] = [];
  const references: Omit<ReferenceRecord, "id">[] = [];
  const symbolByName = new Map<string, Symbol>();
  const parentStack: Symbol[] = [];

  function walk(node: SyntaxNode): void {
    if (DEFINITION_TYPES.has(node.type)) {
      const nameNode = findNameNode(node);
      const name = nameNode ? nodeText(ctx, nameNode.startIndex, nameNode.endIndex) : node.type;

      const parent = parentStack.at(-1);
      const symbol: Symbol = {
        id: createId("sym"),
        name,
        kind: kindFromNodeType(node.type),
        filePath: ctx.filePath,
        startLine: node.startPosition.row,
        endLine: node.endPosition.row,
        startColumn: node.startPosition.column,
        endColumn: node.endPosition.column,
        signature: extractSignature(ctx, node),
        documentation: extractDoc(ctx, node),
        parentId: parent?.id,
        language: ctx.language as SupportedLanguage,
        exported: isExported(node),
      };

      symbols.push(symbol);
      symbolByName.set(name, symbol);

      if (["class", "struct", "interface"].includes(symbol.kind)) {
        parentStack.push(symbol);
        for (const child of node.namedChildren) walk(child);
        parentStack.pop();
        return;
      }
    }

    if (IMPORT_TYPES.has(node.type)) {
      const imp = extractImport(ctx, node);
      if (imp) imports.push(imp);
    }

    if (node.type === "call_expression" || node.type === "call") {
      const callee = node.namedChildren[0];
      if (callee) {
        const caller = parentStack.at(-1);
        if (caller) {
          references.push({
            fromSymbolId: caller.id,
            toName: nodeText(ctx, callee.startIndex, callee.endIndex),
            kind: "call",
            filePath: ctx.filePath,
            line: nodeLine(node),
          });
        }
      }
    }

    if (node.type === "identifier" || node.type === "type_identifier") {
      const name = nodeText(ctx, node.startIndex, node.endIndex);
      const container = parentStack.at(-1);
      if (container && name !== container.name) {
        references.push({
          fromSymbolId: container.id,
          toName: name,
          kind: "read",
          filePath: ctx.filePath,
          line: nodeLine(node),
        });
      }
    }

    for (const child of node.namedChildren) {
      walk(child);
    }
  }

  walk(ctx.root);

  const chunks = symbols.map((symbol) => {
    const header = buildChunkHeader(ctx, symbol);
    return createChunk(
      { filePath: ctx.filePath, language: ctx.language, content: ctx.content, source: ctx.source },
      symbol,
      header,
    );
  });

  return { symbols, imports, references, chunks };
}

function findNameNode(node: SyntaxNode): SyntaxNode | null {
  const nameTypes = ["identifier", "type_identifier", "property_identifier", "field_identifier"];
  for (const child of node.namedChildren) {
    if (nameTypes.includes(child.type)) return child;
    const nested = findNameNode(child);
    if (nested) return nested;
  }
  return null;
}

function extractSignature(ctx: TreeContext, node: SyntaxNode): string | undefined {
  const firstLine = ctx.content.split("\n")[node.startPosition.row]?.trim();
  return firstLine?.slice(0, 200);
}

function extractDoc(ctx: TreeContext, node: SyntaxNode): string | undefined {
  const prev = node.previousSibling;
  if (!prev) return undefined;

  if (prev.type === "comment" || prev.type === "block_comment" || prev.type === "line_comment") {
    return nodeText(ctx, prev.startIndex, prev.endIndex).slice(0, 500);
  }
  return undefined;
}

function buildChunkHeader(ctx: TreeContext, symbol: Symbol): string {
  const parts = [`// File: ${ctx.filePath}`, `// Symbol: ${symbol.name} (${symbol.kind})`];
  if (symbol.signature) parts.push(`// Signature: ${symbol.signature}`);
  return parts.join("\n");
}

function extractImport(
  ctx: TreeContext,
  node: SyntaxNode,
): Omit<ImportRecord, "id" | "fileId"> | null {
  let source = "";
  const importedNames: string[] = [];
  let isDefault = false;

  for (const child of node.namedChildren) {
    if (child.type === "string" || child.type === "string_literal") {
      source = nodeText(ctx, child.startIndex, child.endIndex).replace(/['"]/g, "");
    }
    if (child.type === "import_clause" || child.type === "dotted_name") {
      for (const sub of child.namedChildren) {
        const name = nodeText(ctx, sub.startIndex, sub.endIndex);
        if (name) importedNames.push(name);
      }
    }
    if (child.type === "identifier") {
      importedNames.push(nodeText(ctx, child.startIndex, child.endIndex));
      isDefault = true;
    }
  }

  if (!source && node.type === "import_from_statement") {
    const moduleNode = node.namedChildren.find(
      (c) => c.type === "dotted_name" || c.type === "relative_import",
    );
    if (moduleNode) {
      source = nodeText(ctx, moduleNode.startIndex, moduleNode.endIndex);
    }
  }

  if (!source) return null;

  return {
    filePath: ctx.filePath,
    source,
    importedNames,
    isDefault,
    line: nodeLine(node),
  };
}
