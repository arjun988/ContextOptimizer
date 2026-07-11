---
title: Adding a Language Parser
---

# Adding a Language Parser

Parsers extract symbols from source files using tree-sitter.

## Interface

```typescript
interface Parser {
  readonly supportedLanguages: string[];
  canParse(language: string): boolean;
  parse(filePath: string, content: string, language: string): ParseResult;
}
```

## Steps

1. Install the tree-sitter grammar: `pnpm add tree-sitter-<lang> --filter @contextoptimizer/parser`
2. Register the language in `packages/parser/src/languages.ts`
3. Add symbol extraction queries in `packages/parser/src/queries/<lang>.ts`
4. Add the language to `SupportedLanguage` in `packages/core/src/types.ts`
5. Add detection in `packages/core/src/utils.ts` (`detectLanguage`)
6. Add a fixture file and test in `packages/parser/src/parser.test.ts`

## ParseResult shape

```typescript
interface ParseResult {
  symbols: Symbol[];
  imports: ImportRecord[];
  references: ReferenceRecord[];
  chunks: Chunk[];
}
```

Each symbol becomes a searchable chunk with metadata (name, kind, signature, line range).

## Testing

```bash
pnpm --filter @contextoptimizer/parser test
```

Verify symbols are extracted with correct `filePath`, `startLine`, `endLine`, and `kind`.
