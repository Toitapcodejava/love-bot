from datetime import datetime, timedelta
from pathlib import Path
import httpx

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from config import get_settings

router = APIRouter(prefix="/push", tags=["push"])

TOKEN_FILE = Path("/tmp/expo_push_token")


class RegisterBody(BaseModel):
    token: str


def should_send_push(now: datetime, last_push: datetime | None, sent_today: int) -> bool:
    if sent_today >= 5:
        return False
    if last_push and (now - last_push) < timedelta(hours=4):
        return False
    h = now.hour
    if not (h >= 23 or h < 3 or (10 <= h < 12)):
        return False
    return True


@router.post("/register")
async def register(body: RegisterBody):
    TOKEN_FILE.write_text(body.token)
    return {"ok": True}


@router.post("/tick")
async def tick(request: Request):
    settings = get_settings()
    cron_key = request.headers.get("x-cron-key", "")
    if cron_key != settings.app_shared_key:
        raise HTTPException(status_code=401)

    if not TOKEN_FILE.exists():
        return {"skipped": "no_token"}

    pool = request.app.state.pool
    now = datetime.utcnow()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT sent_at FROM push_log ORDER BY sent_at DESC LIMIT 1"
        )
        last_push = row["sent_at"] if row else None

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        sent_today = await conn.fetchval(
            "SELECT COUNT(*) FROM push_log WHERE sent_at >= $1", today_start
        )

        if not should_send_push(now, last_push, sent_today):
            return {"skipped": "heuristic"}

        mood_row = await conn.fetchrow(
            "SELECT mood FROM mood_snapshots ORDER BY created_at DESC LIMIT 1"
        )
        last_mood = mood_row["mood"] if mood_row else "neutral"

        mem_rows = await conn.fetch(
            "SELECT content FROM memories ORDER BY created_at DESC LIMIT 3"
        )
        memories = [r["content"] for r in mem_rows]

    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    push_prompt = Path("prompts/push.txt").read_text(encoding="utf-8")
    system = push_prompt.format(last_mood=last_mood, memories="\n".join(memories))

    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=120,
        system=system,
        messages=[{"role": "user", "content": "send push?"}],
    )
    text = msg.content[0].text.strip()

    if text.lower() == "null" or not text:
        return {"skipped": "ai_null"}

    token = TOKEN_FILE.read_text().strip()
    async with httpx.AsyncClient() as http:
        await http.post(
            "https://exp.host/--/api/v2/push/send",
            json={"to": token, "body": text, "sound": "default"},
            timeout=10,
        )

    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO push_log (sent_at, message) VALUES ($1, $2)", now, text
        )

    return {"sent": text}
