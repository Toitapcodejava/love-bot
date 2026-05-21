import json
import random
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from anthropic import AsyncAnthropic
from config import settings
from db import get_pool

router = APIRouter()
_client = AsyncAnthropic(api_key=settings.anthropic_api_key)


class VentIn(BaseModel):
    text: str


@router.post("/vent")
async def vent(payload: VentIn, request: Request):
    if request.headers.get("x-app-key") != settings.app_shared_key:
        raise HTTPException(401)
    text = payload.text
    resp = await _client.messages.create(
        model=settings.chat_model,
        max_tokens=200,
        system=(
            "Mày là bạn Tsundere. User vừa trút giận. "
            "Phân loại mood (angry|sad|fake_ok|chill) "
            "và rep 1-2 câu khích lệ trút tiếp. KHÔNG khuyên gì. "
            'Output JSON: {"mood":"...","reply":"..."}'
        ),
        messages=[{"role": "user", "content": text}],
    )
    raw = resp.content[0].text
    try:
        data = json.loads(raw[raw.find("{"):raw.rfind("}") + 1])
    except Exception:
        data = {"mood": "angry", "reply": "Ờ, chửi nữa đi."}
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "insert into mood_snapshots(mood, trigger) values($1,'vent')",
            data["mood"]
        )
    text = None
    del payload
    return {**data, "burn_seed": random.randint(0, 2**31)}
