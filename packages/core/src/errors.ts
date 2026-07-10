export class ContextOptimizerError extends Error {
  readonly code: string;
  override readonly cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = "ContextOptimizerError";
    this.code = code;
    this.cause = cause;
  }
}

export class NotFoundError extends ContextOptimizerError {
  constructor(message: string, cause?: unknown) {
    super(message, "NOT_FOUND", cause);
    this.name = "NotFoundError";
  }
}

export class ParseError extends ContextOptimizerError {
  constructor(message: string, cause?: unknown) {
    super(message, "PARSE_ERROR", cause);
    this.name = "ParseError";
  }
}

export class StorageError extends ContextOptimizerError {
  constructor(message: string, cause?: unknown) {
    super(message, "STORAGE_ERROR", cause);
    this.name = "StorageError";
  }
}

export class EmbeddingError extends ContextOptimizerError {
  constructor(message: string, cause?: unknown) {
    super(message, "EMBEDDING_ERROR", cause);
    this.name = "EmbeddingError";
  }
}

export class ValidationError extends ContextOptimizerError {
  constructor(message: string, cause?: unknown) {
    super(message, "VALIDATION_ERROR", cause);
    this.name = "ValidationError";
  }
}
