import type { Parser as IParser, ParseResult } from "@contextoptimizer/core";
import { ParseError } from "@contextoptimizer/core";
import Parser from "tree-sitter";
import C from "tree-sitter-c";
import Cpp from "tree-sitter-cpp";
import Go from "tree-sitter-go";
import Java from "tree-sitter-java";
import JavaScript from "tree-sitter-javascript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import TypeScript from "tree-sitter-typescript";
import { extractFromTree } from "./language-extractor.js";

type TreeSitterLanguage = unknown;

const LANGUAGE_MAP: Record<string, TreeSitterLanguage> = {
  javascript: JavaScript,
  typescript: TypeScript.typescript,
  python: Python,
  go: Go,
  rust: Rust,
  java: Java,
  c: C,
  cpp: Cpp,
};

export class TreeSitterParser implements IParser {
  readonly supportedLanguages = Object.keys(LANGUAGE_MAP);
  private parsers = new Map<string, Parser>();

  canParse(language: string): boolean {
    return language in LANGUAGE_MAP;
  }

  private getParser(language: string): Parser {
    const cached = this.parsers.get(language);
    if (cached) return cached;

    const grammar = LANGUAGE_MAP[language];
    if (!grammar) {
      throw new ParseError(`Unsupported language: ${language}`);
    }

    const parser = new Parser();
    parser.setLanguage(grammar as Parser.Language);
    this.parsers.set(language, parser);
    return parser;
  }

  parse(filePath: string, content: string, language: string): ParseResult {
    if (!this.canParse(language)) {
      throw new ParseError(`Language not supported: ${language}`);
    }

    try {
      const parser = this.getParser(language);
      const tree = parser.parse(content);
      return extractFromTree({
        filePath,
        language,
        content,
        source: content,
        root: tree.rootNode,
      });
    } catch (error) {
      throw new ParseError(`Failed to parse ${filePath}`, error);
    }
  }
}

export function createParser(): TreeSitterParser {
  return new TreeSitterParser();
}
