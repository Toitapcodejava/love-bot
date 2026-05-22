import httpx
from config import settings

SERPER_URL = "https://google.serper.dev/search"


async def execute_web_search(query: str, num_results: int = 3) -> str:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                SERPER_URL,
                headers={"X-API-KEY": settings.serper_api_key, "Content-Type": "application/json"},
                json={"q": query, "num": num_results},
            )
            r.raise_for_status()
            items = r.json().get("organic", [])[:num_results]
    except Exception:
        return "Không tìm được kết quả."

    if not items:
        return "Không tìm được kết quả."

    lines = []
    for item in items:
        title = item.get("title", "")
        snippet = item.get("snippet", "")
        link = item.get("link", "")
        lines.append(f"{title} — {snippet} ({link})")
    return "\n".join(lines)
