import json
import random
from datetime import date
from pathlib import Path

from anthropic import AsyncAnthropic
from fastapi import APIRouter

from config import settings

router = APIRouter(prefix="/api/quotes", tags=["quotes"])

CACHE_FILE = Path("data/quotes_cache.json")
PROMPT_FILE = Path("prompts/quote_prompt.txt")

_client = AsyncAnthropic(api_key=settings.anthropic_api_key)


def _load_cache() -> dict:
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_cache(data: dict) -> None:
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


async def _generate_quotes() -> list[str]:
    prompt = PROMPT_FILE.read_text(encoding="utf-8")
    msg = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    lines = [l.strip() for l in msg.content[0].text.strip().splitlines() if l.strip()]
    return lines[:5] if len(lines) >= 5 else lines


@router.get("/daily")
async def get_daily_quote():
    today = date.today().isoformat()
    cache = _load_cache()

    if today in cache and cache[today]:
        return {"quote": random.choice(cache[today])}

    quotes = await _generate_quotes()
    if not quotes:
        return {"quote": "Mày đang ổn hơn mày nghĩ."}

    cache[today] = quotes
    _save_cache(cache)
    return {"quote": random.choice(quotes)}
