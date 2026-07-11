from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class SearchQuery(BaseModel):
    text: str
    limit: Optional[int] = 20
    file_path: Optional[str] = Field(None, alias="filePath")
    language: Optional[str] = None

    model_config = {"populate_by_name": True}


class Position(BaseModel):
    line: int
    column: int


class ContextRequest(BaseModel):
    task: str
    current_file: Optional[str] = Field(None, alias="currentFile")
    cursor_position: Optional[Position] = Field(None, alias="cursorPosition")
    open_files: Optional[list[str]] = Field(None, alias="openFiles")
    conversation_summary: Optional[str] = Field(None, alias="conversationSummary")
    budget: Optional[int] = 8000
    limit: Optional[int] = None

    model_config = {"populate_by_name": True}


class CompressRequest(BaseModel):
    text: str
    target_tokens: Optional[int] = Field(None, alias="targetTokens")
    preserve_identifiers: Optional[bool] = Field(True, alias="preserveIdentifiers")

    model_config = {"populate_by_name": True}


class SymbolQuery(BaseModel):
    name: Optional[str] = None
    kind: Optional[str] = None
    file_path: Optional[str] = Field(None, alias="filePath")
    language: Optional[str] = None
    limit: Optional[int] = 100
    offset: Optional[int] = 0

    model_config = {"populate_by_name": True}


class MemoryQuery(BaseModel):
    category: Optional[str] = None
    key: Optional[str] = None
    limit: Optional[int] = 100


class RememberRequest(BaseModel):
    action: Literal["remember"] = "remember"
    category: str = "project_summary"
    key: str = "default"
    content: str


class RecallRequest(BaseModel):
    action: Literal["recall"] = "recall"
    category: Optional[str] = None
    key: Optional[str] = None
    limit: Optional[int] = 100


class IndexResult(BaseModel):
    stats: dict[str, Any]
    repo_path: str = Field(alias="repoPath")

    model_config = {"populate_by_name": True}


class SearchResult(BaseModel):
    chunk_id: str = Field(alias="chunkId")
    symbol_id: Optional[str] = Field(None, alias="symbolId")
    file_path: str = Field(alias="filePath")
    content: str
    score: float
    symbol_name: Optional[str] = Field(None, alias="symbolName")
    metadata: dict[str, Any] = {}

    model_config = {"populate_by_name": True}


class DoctorResult(BaseModel):
    healthy: bool
    checks: dict[str, bool]
