---
title: Python SDK
---

# Python SDK

Package: `contextoptimizer` on PyPI

## Installation

```bash
pip install contextoptimizer
```

## Usage

```python
from contextoptimizer import Client

client = Client("http://localhost:3100", api_key="your-token")

# Health check
print(client.health())

# Index
result = client.index()
print(result.stats)

# Search
results = client.search("how does indexing work", limit=10)
for r in results:
    print(r.file_path, r.score)

# Context retrieval
context = client.get_context(
    task="fix the login bug",
    budget=8000,
    current_file="src/auth.ts",
)
print(context["totalTokens"], "tokens")

# Memory
client.remember("Uses JWT refresh tokens", category="architecture", key="auth")
entries = client.recall(category="architecture")
```

## API surface

| Method | HTTP | Description |
|--------|------|-------------|
| `health()` | GET /health | Health check |
| `metrics()` | GET /metrics | Prometheus metrics |
| `doctor()` | GET /doctor | Diagnostics |
| `index(force=False)` | POST /index | Index repo |
| `search(text, ...)` | POST /search | Semantic search |
| `get_context(task, ...)` | POST /context | Ranked context |
| `compress(text, ...)` | POST /compress | Compress prompt |
| `budget(snippets, budget)` | POST /budget | Budget fitting |
| `get_symbols(**kwargs)` | POST /symbols | Symbol query |
| `neighbors(node_id, depth)` | POST /graph | Graph neighbors |
| `remember(content, ...)` | POST /memory | Store memory |
| `recall(**kwargs)` | POST /memory | Recall memory |

## Error handling

```python
from contextoptimizer import Client, APIError

try:
    client.health()
except APIError as e:
    print(f"HTTP {e.status}: {e.message}")
```
