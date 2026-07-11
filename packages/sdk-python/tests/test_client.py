import pytest
from pytest_httpx import HTTPXMock

from contextoptimizer import Client
from contextoptimizer.exceptions import APIError


def test_health(httpx_mock: HTTPXMock):
    httpx_mock.add_response(json={"status": "ok", "repoPath": "/repo"})
    client = Client("http://localhost:3100")
    assert client.health()["status"] == "ok"


def test_search(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        json=[
            {
                "chunkId": "chunk:1",
                "filePath": "src/index.ts",
                "content": "export function main() {}",
                "score": 0.9,
                "metadata": {},
            }
        ]
    )
    client = Client("http://localhost:3100")
    results = client.search("main function")
    assert len(results) == 1
    assert results[0].file_path == "src/index.ts"


def test_auth_header(httpx_mock: HTTPXMock):
    httpx_mock.add_response(json={"healthy": True, "checks": {}})

    def check_auth(request):
        assert request.headers["authorization"] == "Bearer secret"
        return httpx.Response(200, json={"healthy": True, "checks": {}})

    httpx_mock.add_callback(check_auth)
    client = Client("http://localhost:3100", api_key="secret")
    client.doctor()


def test_api_error(httpx_mock: HTTPXMock):
    httpx_mock.add_response(status_code=401, text="Unauthorized")
    client = Client("http://localhost:3100")
    with pytest.raises(APIError) as exc:
        client.health()
    assert exc.value.status == 401
