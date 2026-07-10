import type { Compressor } from "@contextoptimizer/core";

export function extractIdentifiers(text: string): string[] {
  const patterns = [
    /\b(?:class|interface|type|enum|function|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    /\b([A-Z][A-Za-z0-9_]*)\b/g,
    /\b([a-z_$][\w$]*)\s*\(/g,
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1] && match[1].length > 1) found.add(match[1]);
    }
  }
  return [...found];
}

export function ensureIdentifiersPreserved(original: string, compressed: string): string {
  const identifiers = extractIdentifiers(original);
  let result = compressed;
  for (const id of identifiers) {
    if (!result.includes(id)) {
      result += `\n// preserved: ${id}`;
    }
  }
  return result;
}

export class DedupeCompressor implements Compressor {
  readonly name = "dedupe";

  async compress(text: string): Promise<string> {
    const lines = text.split("\n");
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const line of lines) {
      const normalized = line.trim();
      if (normalized.length === 0) {
        unique.push(line);
        continue;
      }
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(line);
      }
    }
    return unique.join("\n");
  }
}

export class MergeChunksCompressor implements Compressor {
  readonly name = "merge";

  async compress(text: string): Promise<string> {
    const blocks = text.split(/\n{2,}/);
    const merged: string[] = [];
    let current = "";

    for (const block of blocks) {
      if (current.length + block.length < 500) {
        current = current ? `${current}\n${block}` : block;
      } else {
        if (current) merged.push(current);
        current = block;
      }
    }
    if (current) merged.push(current);
    return merged.join("\n\n");
  }
}

export class CodeSkeletonCompressor implements Compressor {
  readonly name = "skeleton";

  async compress(text: string, targetTokens?: number): Promise<string> {
    const lines = text.split("\n");
    const skeleton: string[] = [];
    let inBody = false;
    let braceDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/**") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("import ") ||
        trimmed.startsWith("export ") ||
        trimmed.match(/^(class|function|interface|type|enum|const|let|var|async)\s/)
      ) {
        skeleton.push(line);
        if (trimmed.includes("{")) {
          inBody = true;
          braceDepth += (trimmed.match(/\{/g) ?? []).length;
          braceDepth -= (trimmed.match(/\}/g) ?? []).length;
          if (braceDepth > 0) skeleton.push("  // ... body omitted for brevity");
        }
      } else if (inBody && braceDepth > 0) {
        braceDepth += (trimmed.match(/\{/g) ?? []).length;
        braceDepth -= (trimmed.match(/\}/g) ?? []).length;
        if (braceDepth <= 0) {
          skeleton.push(line);
          inBody = false;
        }
      }
    }

    const result = skeleton.join("\n");
    if (targetTokens && result.length > targetTokens * 4) {
      return `${result.slice(0, targetTokens * 4)}\n// ... truncated`;
    }
    return result;
  }
}

export class ConversationSummarizer implements Compressor {
  readonly name = "conversation";

  async compress(text: string, targetTokens?: number): Promise<string> {
    const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 0);
    const maxSentences = targetTokens ? Math.max(3, Math.floor(targetTokens / 20)) : 5;
    const summary = sentences.slice(-maxSentences).join(". ");
    return summary.endsWith(".") ? summary : `${summary}.`;
  }
}
