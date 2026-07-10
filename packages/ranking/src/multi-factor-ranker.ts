import {
  DEFAULT_RANKING_WEIGHTS,
  type Ranker,
  type RankingCandidate,
  type RankingContext,
  type RankingWeights,
  isTestFile,
  normalizePath,
} from "@contextoptimizer/core";

export class MultiFactorRanker implements Ranker {
  async rank(
    candidates: RankingCandidate[],
    context: RankingContext,
    weights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
  ): Promise<Array<RankingCandidate & { score: number; scores: Record<string, number> }>> {
    const { request } = context;
    const openFiles = new Set((request.openFiles ?? []).map(normalizePath));
    const recentEdits = new Set((request.recentEdits ?? []).map(normalizePath));
    const gitDiffFiles = extractGitDiffFiles(request.gitDiff ?? "");

    const ranked = candidates.map((candidate) => {
      const scores: Record<string, number> = {};

      scores.semanticSimilarity = context.semanticScores.get(candidate.id) ?? 0;

      const graphDist = context.graphDistances.get(candidate.symbolId ?? candidate.filePath);
      scores.dependencyDistance = graphDist !== undefined ? 1 / (1 + graphDist) : 0;

      scores.openFiles = openFiles.has(normalizePath(candidate.filePath)) ? 1 : 0;
      scores.recentEdits = recentEdits.has(normalizePath(candidate.filePath)) ? 1 : 0;
      scores.gitDiffOverlap = gitDiffFiles.has(normalizePath(candidate.filePath)) ? 1 : 0;

      scores.cursorProximity = computeCursorProximity(request, candidate);
      scores.recency = computeRecency(context.fileIndexedAt.get(candidate.filePath));
      scores.popularity = context.popularityScores.get(candidate.symbolId ?? "") ?? 0;

      const score =
        scores.semanticSimilarity! * weights.semanticSimilarity +
        scores.dependencyDistance! * weights.dependencyDistance +
        scores.openFiles! * weights.openFiles +
        scores.gitDiffOverlap! * weights.gitDiffOverlap +
        scores.recentEdits! * weights.recentEdits +
        scores.cursorProximity! * weights.cursorProximity +
        scores.recency! * weights.recency +
        scores.popularity! * weights.popularity;

      return { ...candidate, score, scores };
    });

    return ranked.sort((a, b) => b.score - a.score);
  }
}

function computeCursorProximity(
  request: RankingContext["request"],
  candidate: RankingCandidate,
): number {
  if (!request.currentFile || !request.cursorPosition) return 0;
  if (normalizePath(request.currentFile) !== normalizePath(candidate.filePath)) return 0;

  const cursorLine = request.cursorPosition.line;
  const distance = Math.abs(cursorLine - candidate.startLine);
  return 1 / (1 + distance);
}

function computeRecency(indexedAt?: number): number {
  if (!indexedAt) return 0;
  const ageMs = Date.now() - indexedAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  return Math.exp(-ageHours / 24);
}

function extractGitDiffFiles(gitDiff: string): Set<string> {
  const files = new Set<string>();
  const regex = /^\+\+\+ b\/(.+)$/gm;
  for (const match of gitDiff.matchAll(regex)) {
    if (match[1]) files.add(normalizePath(match[1]));
  }
  return files;
}

export function classifySnippetKind(filePath: string): "code" | "test" | "doc" {
  if (isTestFile(filePath)) return "test";
  if (filePath.endsWith(".md")) return "doc";
  return "code";
}

export function createRanker(): MultiFactorRanker {
  return new MultiFactorRanker();
}
