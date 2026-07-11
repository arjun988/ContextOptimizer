from typing import Any, Optional, Union

import httpx

from contextoptimizer.exceptions import APIError
from contextoptimizer.types import (
    CompressRequest,
    ContextRequest,
    DoctorResult,
    IndexResult,
    MemoryQuery,
    RecallRequest,
    RememberRequest,
    SearchQuery,
    SearchResult,
    SymbolQuery,
)


class Client:
    """Typed REST client for the ContextOptimizer API."""

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        timeout: float = 60.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _request(
        self,
        method: str,
        path: str,
        json: Optional[dict[str, Any]] = None,
    ) -> Any:
        with httpx.Client(timeout=self.timeout) as client:
            response = client.request(
                method,
                f"{self.base_url}{path}",
                headers=self._headers(),
                json=json,
            )
            if response.status_code >= 400:
                raise APIError(response.status_code, response.text)
            if not response.content:
                return None
            if "application/json" in response.headers.get("content-type", ""):
                return response.json()
            return response.text

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health")

    def metrics(self) -> str:
        return self._request("GET", "/metrics")

    def doctor(self) -> DoctorResult:
        data = self._request("GET", "/doctor")
        return DoctorResult.model_validate(data)

    def index(self, force: bool = False) -> IndexResult:
        data = self._request("POST", "/index", {"force": force})
        return IndexResult.model_validate(data)

    def search(self, text: str, limit: int = 20, **kwargs: Any) -> list[SearchResult]:
        query = SearchQuery(text=text, limit=limit, **kwargs)
        data = self._request("POST", "/search", query.model_dump(by_alias=True, exclude_none=True))
        return [SearchResult.model_validate(item) for item in data]

    def get_context(self, task: str, **kwargs: Any) -> dict[str, Any]:
        request = ContextRequest(task=task, **kwargs)
        return self._request(
            "POST",
            "/context",
            request.model_dump(by_alias=True, exclude_none=True),
        )

    def compress(self, text: str, **kwargs: Any) -> dict[str, Any]:
        request = CompressRequest(text=text, **kwargs)
        return self._request(
            "POST",
            "/compress",
            request.model_dump(by_alias=True, exclude_none=True),
        )

    def budget(self, snippets: list[dict[str, Any]], budget: int) -> dict[str, Any]:
        return self._request("POST", "/budget", {"snippets": snippets, "budget": budget})

    def get_symbols(self, **kwargs: Any) -> list[dict[str, Any]]:
        query = SymbolQuery(**kwargs)
        return self._request(
            "POST",
            "/symbols",
            query.model_dump(by_alias=True, exclude_none=True),
        )

    def neighbors(self, node_id: str, depth: int = 1) -> list[dict[str, Any]]:
        return self._request("POST", "/graph", {"nodeId": node_id, "depth": depth})

    def remember(
        self,
        content: str,
        category: str = "project_summary",
        key: str = "default",
    ) -> dict[str, Any]:
        request = RememberRequest(content=content, category=category, key=key)
        return self._request("POST", "/memory", request.model_dump())

    def recall(self, **kwargs: Any) -> list[dict[str, Any]]:
        query = RecallRequest(**kwargs)
        return self._request("POST", "/memory", query.model_dump(exclude_none=True))
