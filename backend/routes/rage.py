import random
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from db import get_pool

router = APIRouter()

HAPTIC = {"hammer": "heavy", "bat": "double", "grenade": "long", "fire": "long"}
QUIPS = {
    "hammer": "Đập vỡ. Hết. Khỏe chưa?",
    "bat": "Phang đi. Phang nữa đi.",
    "grenade": "Nổ tan. Sạch sẽ.",
    "fire": "Cháy đi. Tro tàn lượm sau.",
}


class RageIn(BaseModel):
    target_text: str
    weapon: str  # hammer|bat|grenade|fire


@router.post("/rage")
async def rage(payload: RageIn, request: Request):
    from config import settings
    if request.headers.get("x-app-key") != settings.app_shared_key:
        raise HTTPException(401)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "insert into mood_snapshots(mood, trigger) values('angry','rage')"
        )
    payload.target_text = None
    return {
        "haptic_pattern": HAPTIC.get(payload.weapon, "heavy"),
        "particle_seed": random.randint(0, 2**31),
        "quip": QUIPS.get(payload.weapon, "Đập đi."),
    }
