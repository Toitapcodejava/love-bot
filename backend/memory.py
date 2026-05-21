import json
import asyncio
import voyageai
from anthropic import AsyncAnthropic
from config import settings, load_prompt
from db import get_pool

_vo = voyageai.AsyncClient(api_key=settings.voyage_api_key)
_anthro = AsyncAnthropic(api_key=settings.anthropic_api_key)


async def embed(text: str) -> list[float]:
    res = await _vo.embed([text], model="voyage-3", input_type="document")
    return res.embeddings[0]


async def rag_top_k(query: str, k: int = 5) -> list[str]:
    q_emb = await embed(query)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """select content from memories
               order by pinned desc, embedding <=> $1::vector
               limit $2""",
            str(q_emb), k
        )
    return [r["content"] for r in rows]


async def recent_turns(limit: int = 10) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "select role, content from conversations order by created_at desc limit $1",
            limit
        )
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


async def save_turn(role: str, content: str, mood: str | None = None) -> int:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "insert into conversations(role,content,mood) values($1,$2,$3) returning id",
            role, content, mood
        )


def _parse_extraction(raw: str) -> list[dict]:
    try:
        start = raw.find("[")
        end = raw.rfind("]")
        if start == -1 or end == -1:
            return []
        data = json.loads(raw[start:end + 1])
        return [x for x in data if isinstance(x, dict) and "content" in x and "tag" in x]
    except Exception:
        return []


async def extract_and_save(user_msg: str, ai_reply: str, source_turn: int):
    prompt = load_prompt("extract").format(user_msg=user_msg, ai_reply=ai_reply)
    resp = await _anthro.messages.create(
        model=settings.extract_model,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text if resp.content else ""
    facts = _parse_extraction(raw)
    if not facts:
        return
    pool = await get_pool()
    async with pool.acquire() as conn:
        for f in facts:
            emb = await embed(f["content"])
            await conn.execute(
                "insert into memories(content,tag,embedding,source_turn) values($1,$2,$3::vector,$4)",
                f["content"], f["tag"], str(emb), source_turn
            )
