import httpx
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from anthropic import AsyncAnthropic
from config import settings, load_prompt
from db import get_pool

router = APIRouter()
_client = AsyncAnthropic(api_key=settings.anthropic_api_key)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_QUERY = """
[out:json][timeout:10];
(
  node["amenity"~"cafe|restaurant|fast_food|bar|park|cinema|mall|supermarket"](around:{radius},{lat},{lng});
  node["leisure"~"park|garden|playground"](around:{radius},{lat},{lng});
);
out body 20;
"""


class LocationIn(BaseModel):
    lat: float
    lng: float
    accuracy: float | None = None


def _check_key(request: Request):
    if request.headers.get("x-app-key") != settings.app_shared_key:
        raise HTTPException(401)


async def _fetch_poi(lat: float, lng: float, radius: int = 1000) -> list[str]:
    query = OVERPASS_QUERY.format(radius=radius, lat=lat, lng=lng)
    try:
        async with httpx.AsyncClient(timeout=12) as http:
            r = await http.post(OVERPASS_URL, data={"data": query})
            r.raise_for_status()
            elements = r.json().get("elements", [])
    except Exception:
        return []

    poi = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name")
        amenity = tags.get("amenity") or tags.get("leisure", "địa điểm")
        if name:
            poi.append(f"{name} ({amenity})")
    return poi[:15]


@router.post("/location/update")
async def location_update(body: LocationIn, request: Request):
    _check_key(request)
    if body.accuracy and body.accuracy > 100:
        return {"ok": True, "skipped": "low_accuracy"}
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO location_history (lat, lng, accuracy) VALUES ($1, $2, $3)",
            body.lat, body.lng, body.accuracy,
        )
    return {"ok": True}


@router.get("/location/suggest")
async def location_suggest(request: Request):
    _check_key(request)
    pool = await get_pool()
    async with pool.acquire() as conn:
        loc = await conn.fetchrow(
            "SELECT lat, lng FROM location_history ORDER BY created_at DESC LIMIT 1"
        )
        mood_row = await conn.fetchrow(
            "SELECT mood FROM mood_snapshots ORDER BY created_at DESC LIMIT 1"
        )
        mood = mood_row["mood"] if mood_row else "neutral"

        if loc:
            poi = await _fetch_poi(loc["lat"], loc["lng"])
            poi_text = "\n".join(f"- {p}" for p in poi) if poi else "Không có thông tin địa điểm cụ thể."
            prompt = load_prompt("suggest").format(poi_list=poi_text, mood=mood)
        else:
            memories = await conn.fetch(
                "SELECT content FROM memories ORDER BY created_at DESC LIMIT 10"
            )
            memory_text = "\n".join(f"- {m['content']}" for m in memories) or "(chưa có thông tin về Kem)"
            prompt = load_prompt("suggest_no_location").format(memories=memory_text, mood=mood)

    msg = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        system=prompt,
        messages=[{"role": "user", "content": "gợi ý cho Kem đi"}],
    )
    text = msg.content[0].text.strip()
    suggestions = [s.strip() for s in text.split("\n") if s.strip()]
    return {"suggestions": suggestions}
