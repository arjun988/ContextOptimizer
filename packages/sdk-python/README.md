# ContextOptimizer Python SDK

Typed REST client for the ContextOptimizer API.

```python
from contextoptimizer import Client

client = Client("http://localhost:3100", api_key="your-token")
result = client.index()
results = client.search("how does indexing work")
context = client.get_context(task="fix login bug", budget=8000)
```
