import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";

const EXTENSION_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
};

export function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? "unknown";
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function createId(prefix = ""): string {
  return prefix ? `${prefix}:${randomUUID()}` : randomUUID();
}

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function isTestFile(filePath: string): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  return (
    normalized.includes("/test/") ||
    normalized.includes("/tests/") ||
    normalized.includes("/__tests__/") ||
    /\.(test|spec)\.[a-z]+$/.test(normalized)
  );
}

export function isDocFile(filePath: string): boolean {
  const normalized = normalizePath(filePath).toLowerCase();
  return normalized.endsWith(".md") || normalized.endsWith(".rst") || normalized.includes("/docs/");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function splitCodeIdentifiers(text: string): string[] {
  const tokens: string[] = [];

  for (const segment of text.split(/[^a-zA-Z0-9_./-]+/)) {
    if (!segment) continue;

    const lower = segment.toLowerCase();
    tokens.push(lower);

    const camelParts = segment
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .split(/\s+/)
      .map((part) => part.toLowerCase())
      .filter((part) => part.length > 0);

    for (const part of camelParts) {
      tokens.push(part);
    }

    for (const pathPart of segment.split(/[./_-]+/)) {
      if (pathPart.length > 1) {
        tokens.push(pathPart.toLowerCase());
      }
    }
  }

  return tokens;
}

export function tokenizeForSearch(text: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const token of splitCodeIdentifiers(text)) {
    if (token.length < 2) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}

export function bm25Score(
  queryTerms: string[],
  document: string,
  avgDocLength: number,
  docFrequency: Map<string, number>,
  totalDocs: number,
): number {
  const k1 = 1.2;
  const b = 0.75;
  const docTerms = tokenizeForSearch(document);
  const docLength = docTerms.length;
  const termFreq = new Map<string, number>();

  for (const term of docTerms) {
    termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
  }

  let score = 0;
  for (const term of queryTerms) {
    const tf = termFreq.get(term) ?? 0;
    if (tf === 0) continue;

    const df = docFrequency.get(term) ?? 0;
    const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + (b * docLength) / Math.max(avgDocLength, 1));
    score += idf * (numerator / denominator);
  }

  return score;
}
