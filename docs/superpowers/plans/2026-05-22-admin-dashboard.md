# Admin Dashboard & GPS Location Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin web dashboard at `/admin` and GPS background location tracking with AI-powered activity suggestions.

**Architecture:** Backend gains two new route modules (`location.py`, `admin.py`), a DB migration for `location_history`, and a static `admin.html` served by FastAPI. The Expo app gains a background location task (`expo-location`), a settings toggle, and a suggestion card in the chat screen.

**Tech Stack:** FastAPI, asyncpg, Leaflet.js (CDN), Overpass API (free), `expo-location`, `expo-task-manager`, SecureStore, Claude Haiku

---

## File Map

**Create:**
- `backend/migrations/002_location.sql` — location_history table
- `backend/routes/location.py` — POST /location/update, GET /location/suggest
- `backend/routes/admin.py` — admin auth + all /admin/api/* routes + HTML serve
- `backend/static/admin.html` — dashboard UI (vanilla JS + Leaflet)
- `backend/prompts/suggest.txt` — AI suggestion prompt
- `backend/tests/__init__.py` — test package
- `backend/tests/test_location.py` — tests for location routes
- `backend/tests/test_admin.py` — tests for admin routes
- `app/lib/location.ts` — background task registration + API helpers

**Modify:**
- `backend/config.py` — add `admin_key: str`
- `backend/db.py` — run migration 002 alongside 001
- `backend/main.py` — include location + admin routers
- `backend/.env` + `backend/.env.example` — add `ADMIN_KEY`
- `app/app/(tabs)/settings.tsx` — add GPS toggle
- `app/app/(tabs)/index.tsx` — add suggestion card

---

## Task 1: DB Migration — location_history

**Files:**
- Create: `backend/migrations/002_location.sql`
- Modify: `backend/db.py`

- [ ] **Step 1: Create migration file**

```sql
-- backend/migrations/002_location.sql
create table if not exists location_history (
  id bigserial primary key,
  lat double precision not null,
  lng double precision not null,
  accuracy real,
  created_at timestamptz default now()
);
create index if not exists idx_loc_created on location_history (created_at desc);
```

- [ ] **Step 2: Update db.py to run both migrations**

Replace the `run_migrations` function in `backend/db.py`:

```python
async def run_migrations(pool):
    for name in ["001_init.sql", "002_location.sql"]:
        sql = Path(__file__).parent.joinpath("migrations", name).read_text()
        async with pool.acquire() as conn:
            await conn.execute(sql)
```

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/002_location.sql backend/db.py
git commit -m "feat: add location_history table migration"
```

---

## Task 2: Config — add admin_key

**Files:**
- Modify: `backend/config.py`
- Modify: `backend/.env`
- Modify: `backend/.env.example`

- [ ] **Step 1: Add admin_key to Settings**

In `backend/config.py`, add `admin_key` field to the `Settings` class:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    anthropic_api_key: str
    voyage_api_key: str
    database_url: str
    app_shared_key: str
    admin_key: str
    chat_model: str = "claude-sonnet-4-6"
    extract_model: str = "claude-haiku-4-5-20251001"
```

- [ ] **Step 2: Add ADMIN_KEY to .env and .env.example**

In `backend/.env`, add:
```
ADMIN_KEY=change-me-strong-secret
```

In `backend/.env.example`, add:
```
ADMIN_KEY=your-admin-secret-here
```

- [ ] **Step 3: Commit**

```bash
git add backend/config.py backend/.env.example
git commit -m "feat: add ADMIN_KEY config setting"
```

---

## Task 3: Suggestion prompt

**Files:**
- Create: `backend/prompts/suggest.txt`

- [ ] **Step 1: Create suggest.txt**

```
Bạn là "Bạn của Kem" — một người bạn thân thiết, ấm áp và đôi khi khó tính nhưng luôn quan tâm.
Kem đang ở gần các địa điểm sau:
{poi_list}

Tâm trạng hiện tại của Kem: {mood}

Hãy gợi ý 2-3 hoạt động hoặc địa điểm cụ thể cho Kem, phù hợp với tâm trạng.
Ưu tiên các địa điểm có tên cụ thể trong danh sách trên.
Viết ngắn gọn, tự nhiên như một người bạn nhắn tin. Không dùng bullet points. Không hỏi lại.
```

- [ ] **Step 2: Commit**

```bash
git add backend/prompts/suggest.txt
git commit -m "feat: add location suggestion prompt"
```

---

## Task 4: Test setup + location route tests

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_location.py`

- [ ] **Step 1: Install test dependencies**

```bash
cd backend
pip install pytest pytest-asyncio httpx
```

- [ ] **Step 2: Create test package**

Create `backend/tests/__init__.py` as empty file.

- [ ] **Step 3: Write failing tests for location routes**

Create `backend/tests/test_location.py`:

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

# Set env vars before importing app
import os
os.environ.setdefault("DATABASE_URL", "postgresql://fake/fake")
os.environ.setdefault("ANTHROPIC_API_KEY", "fake")
os.environ.setdefault("VOYAGE_API_KEY", "fake")
os.environ.setdefault("APP_SHARED_KEY", "test-key")
os.environ.setdefault("ADMIN_KEY", "admin-test-key")

from fastapi import FastAPI
from routes.location import router

app = FastAPI()
app.include_router(router)


@pytest.mark.asyncio
async def test_location_update_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/location/update", json={"lat": 21.0, "lng": 105.0, "accuracy": 10.0})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_location_update_saves_record():
    mock_conn = AsyncMock()
    mock_pool = AsyncMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    with patch("routes.location.get_pool", return_value=mock_pool):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.post(
                "/location/update",
                json={"lat": 21.02, "lng": 105.83, "accuracy": 15.0},
                headers={"x-app-key": "test-key"},
            )
    assert r.status_code == 200
    assert r.json() == {"ok": True}
    mock_conn.execute.assert_called_once()


@pytest.mark.asyncio
async def test_location_suggest_no_location_returns_empty():
    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_pool = AsyncMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    with patch("routes.location.get_pool", return_value=mock_pool):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.get("/location/suggest", headers={"x-app-key": "test-key"})
    assert r.status_code == 200
    assert r.json() == {"suggestions": []}
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
cd backend
python -m pytest tests/test_location.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'routes.location'`

---

## Task 5: Implement routes/location.py

**Files:**
- Create: `backend/routes/location.py`

- [ ] **Step 1: Create location.py**

```python
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
        if not loc:
            return {"suggestions": []}
        mood_row = await conn.fetchrow(
            "SELECT mood FROM mood_snapshots ORDER BY created_at DESC LIMIT 1"
        )

    mood = mood_row["mood"] if mood_row else "neutral"
    poi = await _fetch_poi(loc["lat"], loc["lng"])

    if not poi:
        poi_text = "Không có thông tin địa điểm cụ thể."
    else:
        poi_text = "\n".join(f"- {p}" for p in poi)

    prompt = load_prompt("suggest").format(poi_list=poi_text, mood=mood)
    msg = await _client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        system=prompt,
        messages=[{"role": "user", "content": "gợi ý cho Kem đi"}],
    )
    text = msg.content[0].text.strip()
    suggestions = [s.strip() for s in text.split("\n") if s.strip()]
    return {"suggestions": suggestions}
```

- [ ] **Step 2: Run location tests**

```bash
cd backend
python -m pytest tests/test_location.py -v
```

Expected: All 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/routes/location.py backend/tests/__init__.py backend/tests/test_location.py
git commit -m "feat: add /location/update and /location/suggest routes"
```

---

## Task 6: Admin route tests

**Files:**
- Create: `backend/tests/test_admin.py`

- [ ] **Step 1: Write failing tests for admin routes**

Create `backend/tests/test_admin.py`:

```python
import pytest
import os
os.environ.setdefault("DATABASE_URL", "postgresql://fake/fake")
os.environ.setdefault("ANTHROPIC_API_KEY", "fake")
os.environ.setdefault("VOYAGE_API_KEY", "fake")
os.environ.setdefault("APP_SHARED_KEY", "test-key")
os.environ.setdefault("ADMIN_KEY", "admin-test-key")

from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock
from fastapi import FastAPI
from routes.admin import router

app = FastAPI()
app.include_router(router)


@pytest.mark.asyncio
async def test_admin_api_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/admin/api/status")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_admin_api_wrong_key():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/admin/api/status", headers={"x-admin-key": "wrong"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_admin_status_returns_data():
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(side_effect=[
        [{"mood": "warm", "confidence": 0.9, "trigger": None, "created_at": "2026-05-22"}],
        [{"message": "hey", "sent_at": "2026-05-22", "opened": False}],
    ])
    mock_pool = AsyncMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    with patch("routes.admin.get_pool", return_value=mock_pool):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.get("/admin/api/status", headers={"x-admin-key": "admin-test-key"})
    assert r.status_code == 200
    data = r.json()
    assert "moods" in data
    assert "push_log" in data


@pytest.mark.asyncio
async def test_admin_push_send():
    from pathlib import Path
    import tempfile, os
    tmp = tempfile.mktemp()
    Path(tmp).write_text("ExponentPushToken[test123]")

    mock_conn = AsyncMock()
    mock_pool = AsyncMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    import httpx
    with patch("routes.admin.TOKEN_FILE", Path(tmp)), \
         patch("routes.admin.get_pool", return_value=mock_pool), \
         patch("httpx.AsyncClient") as mock_http:
        mock_http.return_value.__aenter__ = AsyncMock(return_value=AsyncMock(post=AsyncMock()))
        mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.post(
                "/admin/api/push/send",
                json={"message": "Kem ơi!"},
                headers={"x-admin-key": "admin-test-key"},
            )
    assert r.status_code == 200
    assert r.json()["sent"] == "Kem ơi!"
    os.unlink(tmp)
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
python -m pytest tests/test_admin.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'routes.admin'`

---

## Task 7: Implement routes/admin.py

**Files:**
- Create: `backend/routes/admin.py`

- [ ] **Step 1: Create admin.py**

```python
from datetime import datetime
from pathlib import Path
import httpx

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from config import settings
from db import get_pool

router = APIRouter()

TOKEN_FILE = Path("/tmp/expo_push_token")
STATIC_DIR = Path(__file__).parent.parent / "static"


def _check_admin(request: Request):
    if request.headers.get("x-admin-key") != settings.admin_key:
        raise HTTPException(401)


# ── HTML dashboard ──────────────────────────────────────────────────────────

@router.get("/admin", response_class=HTMLResponse)
async def admin_dashboard():
    html = (STATIC_DIR / "admin.html").read_text(encoding="utf-8")
    return HTMLResponse(html)


# ── Push ─────────────────────────────────────────────────────────────────────

class PushBody(BaseModel):
    message: str


@router.post("/admin/api/push/send")
async def admin_push_send(body: PushBody, request: Request):
    _check_admin(request)
    if not TOKEN_FILE.exists():
        raise HTTPException(400, "no push token registered")

    token = TOKEN_FILE.read_text().strip()
    now = datetime.utcnow()

    async with httpx.AsyncClient() as http:
        await http.post(
            "https://exp.host/--/api/v2/push/send",
            json={"to": token, "body": body.message, "sound": "default"},
            timeout=10,
        )

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO push_log (sent_at, message) VALUES ($1, $2)", now, body.message
        )

    return {"sent": body.message}


@router.get("/admin/api/push/log")
async def admin_push_log(request: Request):
    _check_admin(request)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT message, sent_at, opened FROM push_log ORDER BY sent_at DESC LIMIT 50"
        )
    return {"items": [dict(r) for r in rows]}


# ── Location ──────────────────────────────────────────────────────────────────

@router.get("/admin/api/location")
async def admin_location(request: Request):
    _check_admin(request)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT lat, lng, accuracy, created_at FROM location_history ORDER BY created_at DESC LIMIT 200"
        )
    return {"items": [dict(r) for r in rows]}


# ── Chat log ─────────────────────────────────────────────────────────────────

@router.get("/admin/api/chat")
async def admin_chat(request: Request, page: int = 0, limit: int = 50):
    _check_admin(request)
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, role, content, mood, created_at FROM conversations "
            "ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            limit, page * limit,
        )
    return {"items": [dict(r) for r in rows]}


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/admin/api/status")
async def admin_status(request: Request):
    _check_admin(request)
    pool = await get_pool()
    async with pool.acquire() as conn:
        moods = await conn.fetch(
            "SELECT mood, confidence, trigger, created_at FROM mood_snapshots ORDER BY created_at DESC LIMIT 100"
        )
        push = await conn.fetch(
            "SELECT message, sent_at, opened FROM push_log ORDER BY sent_at DESC LIMIT 50"
        )
    return {
        "moods": [dict(r) for r in moods],
        "push_log": [dict(r) for r in push],
    }
```

- [ ] **Step 2: Run admin tests**

```bash
cd backend
python -m pytest tests/test_admin.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/routes/admin.py backend/tests/test_admin.py
git commit -m "feat: add admin API routes with ADMIN_KEY auth"
```

---

## Task 8: Wire up routers in main.py

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update main.py to include new routers**

Replace the imports and router includes in `backend/main.py`:

```python
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from db import get_pool, run_migrations
from routes import chat as chat_route, vent as vent_route, rage as rage_route, memory as memory_route
from routes.push import router as push_router
from routes.location import router as location_router
from routes.admin import router as admin_router


@asynccontextmanager
async def lifespan(app):
    pool = await get_pool()
    await run_migrations(pool)
    app.state.pool = pool
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(chat_route.router)
app.include_router(vent_route.router)
app.include_router(rage_route.router)
app.include_router(memory_route.router)
app.include_router(push_router)
app.include_router(location_router)
app.include_router(admin_router)


@app.get("/health")
async def health():
    return {"ok": True}
```

- [ ] **Step 2: Run all tests**

```bash
cd backend
python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: wire location and admin routers into main app"
```

---

## Task 9: Admin dashboard HTML

**Files:**
- Create: `backend/static/admin.html`

- [ ] **Step 1: Create static directory**

```bash
mkdir -p backend/static
```

- [ ] **Step 2: Create admin.html**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin — Bạn của Kem</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d0d0d; color: #e0e0e0; font-family: monospace; font-size: 13px; }
  #login { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; gap:12px; }
  #login input { background:#1a1a1a; border:1px solid #333; color:#e0e0e0; padding:10px 14px; border-radius:6px; width:280px; font-family:monospace; }
  button { background:#333; color:#e0e0e0; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-family:monospace; }
  button:hover { background:#444; }
  button.primary { background:#c0392b; }
  button.primary:hover { background:#e74c3c; }
  #app { display:none; flex-direction:column; height:100vh; }
  .tabs { display:flex; background:#111; border-bottom:1px solid #222; }
  .tab { padding:10px 20px; cursor:pointer; border-bottom:2px solid transparent; }
  .tab.active { border-bottom-color:#c0392b; color:#fff; }
  .tab-content { display:none; flex:1; overflow:auto; padding:16px; }
  .tab-content.active { display:block; }
  #map { height:500px; border-radius:8px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th,td { text-align:left; padding:6px 10px; border-bottom:1px solid #1e1e1e; }
  th { color:#888; font-weight:normal; }
  .msg-user { color:#7ec8e3; }
  .msg-assistant { color:#b8e0b8; }
  textarea { width:100%; background:#1a1a1a; border:1px solid #333; color:#e0e0e0; padding:10px; border-radius:6px; font-family:monospace; resize:vertical; }
  .row { display:flex; gap:8px; align-items:flex-start; margin-top:8px; }
  .badge { display:inline-block; padding:2px 6px; border-radius:4px; font-size:11px; background:#222; }
  #status-bar { padding:6px 16px; background:#111; font-size:11px; color:#555; border-top:1px solid #1e1e1e; }
  .pagination { display:flex; gap:8px; margin-top:12px; align-items:center; }
</style>
</head>
<body>

<div id="login">
  <div style="color:#c0392b;font-size:18px;margin-bottom:8px;">⚙ Admin — Bạn của Kem</div>
  <input id="key-input" type="password" placeholder="Admin key" />
  <button class="primary" onclick="doLogin()">Đăng nhập</button>
  <div id="login-err" style="color:#e74c3c;font-size:12px;"></div>
</div>

<div id="app">
  <div class="tabs">
    <div class="tab active" onclick="switchTab('push')">📢 Push</div>
    <div class="tab" onclick="switchTab('gps')">📍 GPS</div>
    <div class="tab" onclick="switchTab('chat')">💬 Chat Log</div>
    <div class="tab" onclick="switchTab('status')">📊 Status</div>
  </div>

  <!-- PUSH TAB -->
  <div id="tab-push" class="tab-content active">
    <h3 style="margin-bottom:12px;">Gửi thông báo thủ công</h3>
    <textarea id="push-msg" rows="3" placeholder="Nhập nội dung noti..."></textarea>
    <div class="row">
      <button class="primary" onclick="sendPush()">Gửi ngay</button>
      <span id="push-status" style="color:#888;"></span>
    </div>
    <h3 style="margin:16px 0 8px;">Lịch sử push</h3>
    <table id="push-log-table">
      <thead><tr><th>Thời gian</th><th>Nội dung</th><th>Đã mở</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <!-- GPS TAB -->
  <div id="tab-gps" class="tab-content">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3>Vị trí của Kem</h3>
      <button onclick="loadGPS()">↻ Refresh</button>
    </div>
    <div id="map"></div>
    <div id="gps-count" style="color:#555;margin-top:8px;font-size:11px;"></div>
  </div>

  <!-- CHAT TAB -->
  <div id="tab-chat" class="tab-content">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3>Lịch sử chat</h3>
      <button onclick="loadChat()">↻ Refresh</button>
    </div>
    <div id="chat-log"></div>
    <div class="pagination">
      <button onclick="chatPage--; loadChat()">← Trước</button>
      <span id="chat-page-label"></span>
      <button onclick="chatPage++; loadChat()">Tiếp →</button>
    </div>
  </div>

  <!-- STATUS TAB -->
  <div id="tab-status" class="tab-content">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <h3>Mood & Push Log</h3>
      <button onclick="loadStatus()">↻ Refresh</button>
    </div>
    <h4 style="margin:12px 0 6px;color:#888;">Mood Snapshots</h4>
    <table id="mood-table">
      <thead><tr><th>Thời gian</th><th>Mood</th><th>Confidence</th><th>Trigger</th></tr></thead>
      <tbody></tbody>
    </table>
    <h4 style="margin:16px 0 6px;color:#888;">Push Log</h4>
    <table id="status-push-table">
      <thead><tr><th>Thời gian</th><th>Nội dung</th><th>Đã mở</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <div id="status-bar">Chưa load dữ liệu</div>
</div>

<script>
let adminKey = '';
let map = null;
let chatPage = 0;
let pollTimer = null;

function doLogin() {
  const k = document.getElementById('key-input').value.trim();
  if (!k) return;
  adminKey = k;
  sessionStorage.setItem('admin_key', k);
  document.getElementById('login-err').textContent = '';
  loadAll();
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { 'x-admin-key': adminKey, 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  if (r.status === 401) {
    adminKey = '';
    sessionStorage.removeItem('admin_key');
    document.getElementById('app').style.display = 'none';
    document.getElementById('login').style.display = 'flex';
    document.getElementById('login-err').textContent = 'Sai key hoặc hết phiên.';
    throw new Error('401');
  }
  return r.json();
}

function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg + ' — ' + new Date().toLocaleTimeString('vi-VN');
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const names = ['push','gps','chat','status'];
    t.classList.toggle('active', names[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'gps' && !map) initMap();
  if (name === 'gps') loadGPS();
  if (name === 'chat') loadChat();
  if (name === 'status') loadStatus();
}

function loadAll() {
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  loadPushLog();
  loadStatus();
  startPolling();
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    loadPushLog();
    loadStatus();
  }, 30000);
}

// ── Push ──────────────────────────────────────────────────────────────────
async function sendPush() {
  const msg = document.getElementById('push-msg').value.trim();
  if (!msg) return;
  const el = document.getElementById('push-status');
  el.textContent = 'Đang gửi...';
  try {
    await api('/admin/api/push/send', { method: 'POST', body: JSON.stringify({ message: msg }) });
    document.getElementById('push-msg').value = '';
    el.textContent = 'Đã gửi ✓';
    loadPushLog();
  } catch (e) {
    if (e.message !== '401') el.textContent = 'Lỗi gửi.';
  }
}

async function loadPushLog() {
  try {
    const data = await api('/admin/api/push/log');
    const tbody = document.querySelector('#push-log-table tbody');
    tbody.innerHTML = data.items.map(r =>
      `<tr><td>${fmt(r.sent_at)}</td><td>${esc(r.message)}</td><td>${r.opened ? '✓' : '—'}</td></tr>`
    ).join('');
    setStatus('Push log cập nhật');
  } catch (e) {}
}

// ── GPS ───────────────────────────────────────────────────────────────────
function initMap() {
  map = L.map('map').setView([21.028, 105.834], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
}

async function loadGPS() {
  if (!map) initMap();
  try {
    const data = await api('/admin/api/location');
    map.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.CircleMarker) map.removeLayer(l); });

    const items = data.items;
    if (!items.length) { document.getElementById('gps-count').textContent = 'Chưa có dữ liệu GPS.'; return; }

    const bounds = [];
    items.forEach((loc, i) => {
      const ratio = i / (items.length - 1 || 1);
      const r = Math.round(46 + ratio * 186);
      const b = Math.round(52 - ratio * 52);
      const color = `rgb(${r},${Math.round(52*(1-ratio))},${b})`;
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: i === 0 ? 10 : 6,
        color, fillColor: color, fillOpacity: 0.85, weight: 2,
      }).addTo(map);
      marker.bindPopup(`<b>${fmt(loc.created_at)}</b><br>${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}<br>Độ chính xác: ${loc.accuracy ? loc.accuracy.toFixed(0)+'m' : '?'}`);
      bounds.push([loc.lat, loc.lng]);
    });
    map.fitBounds(bounds, { padding: [40, 40] });
    document.getElementById('gps-count').textContent = `${items.length} điểm. Mới nhất: ${fmt(items[0].created_at)}`;
  } catch (e) {}
}

// ── Chat ──────────────────────────────────────────────────────────────────
async function loadChat() {
  if (chatPage < 0) chatPage = 0;
  try {
    const data = await api(`/admin/api/chat?page=${chatPage}&limit=50`);
    document.getElementById('chat-page-label').textContent = `Trang ${chatPage + 1}`;
    const el = document.getElementById('chat-log');
    el.innerHTML = data.items.map(m => `
      <div style="margin-bottom:6px;padding:6px 10px;background:#111;border-radius:4px;border-left:2px solid ${m.role==='user'?'#3498db':'#27ae60'}">
        <span class="badge">${m.role}</span>
        ${m.mood ? `<span class="badge" style="margin-left:4px;">${m.mood}</span>` : ''}
        <span style="color:#555;margin-left:8px;">${fmt(m.created_at)}</span>
        <div class="${m.role==='user'?'msg-user':'msg-assistant'}" style="margin-top:4px;">${esc(m.content)}</div>
      </div>`
    ).join('');
  } catch (e) {}
}

// ── Status ────────────────────────────────────────────────────────────────
async function loadStatus() {
  try {
    const data = await api('/admin/api/status');
    document.querySelector('#mood-table tbody').innerHTML = data.moods.map(r =>
      `<tr><td>${fmt(r.created_at)}</td><td>${r.mood}</td><td>${r.confidence ? (r.confidence*100).toFixed(0)+'%' : '—'}</td><td>${r.trigger || '—'}</td></tr>`
    ).join('');
    document.querySelector('#status-push-table tbody').innerHTML = data.push_log.map(r =>
      `<tr><td>${fmt(r.sent_at)}</td><td>${esc(r.message)}</td><td>${r.opened ? '✓' : '—'}</td></tr>`
    ).join('');
    setStatus('Status cập nhật');
  } catch (e) {}
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fmt(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('vi-VN');
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Auto-login from session
const saved = sessionStorage.getItem('admin_key');
if (saved) { adminKey = saved; loadAll(); }
</script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add backend/static/admin.html
git commit -m "feat: add admin dashboard HTML with push/GPS/chat/status tabs"
```

---

## Task 10: App — location.ts background task

**Files:**
- Create: `app/lib/location.ts`

- [ ] **Step 1: Install expo-location and expo-task-manager**

```bash
cd app
npx expo install expo-location expo-task-manager
```

- [ ] **Step 2: Add background location permission to app.json**

In `app/app.json`, inside the `expo` object, add/update the `plugins` array and permissions:

```json
"plugins": [
  [
    "expo-location",
    {
      "locationAlwaysAndWhenInUsePermission": "Bạn của Kem muốn biết bạn đang ở đâu để gợi ý những hoạt động và địa điểm phù hợp với tâm trạng của bạn.",
      "locationWhenInUsePermission": "Bạn của Kem muốn biết bạn đang ở đâu để gợi ý những hoạt động và địa điểm phù hợp với tâm trạng của bạn.",
      "isIosBackgroundLocationEnabled": true,
      "isAndroidBackgroundLocationEnabled": true
    }
  ]
]
```

- [ ] **Step 3: Create app/lib/location.ts**

```typescript
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";

const TASK_NAME = "LOCATION_BACKGROUND_UPDATE";
const LOCATION_ENABLED_KEY = "LOCATION_ENABLED";

// Called by TaskManager when a background location update fires
TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  if (error || !data?.locations?.length) return;
  const loc = data.locations[0];
  if (loc.coords.accuracy && loc.coords.accuracy > 100) return;

  const base = await SecureStore.getItemAsync("BASE_URL") ?? "";
  const key = await SecureStore.getItemAsync("APP_KEY") ?? "";
  if (!base || !key) return;

  try {
    await fetch(`${base}/location/update`, {
      method: "POST",
      headers: { "x-app-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      }),
    });
  } catch {
    // silently ignore network errors in background task
  }
});

export async function isLocationEnabled(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(LOCATION_ENABLED_KEY);
  return v === "1";
}

export async function enableLocation(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") return false;

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== "granted") return false;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15 * 60 * 1000, // 15 minutes
    distanceInterval: 200,         // or 200m moved
    deferredUpdatesInterval: 15 * 60 * 1000,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: "Bạn của Kem",
      notificationBody: "Đang cập nhật vị trí",
    },
  });

  await SecureStore.setItemAsync(LOCATION_ENABLED_KEY, "1");
  return true;
}

export async function disableLocation(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
  await SecureStore.setItemAsync(LOCATION_ENABLED_KEY, "0");
}

export async function fetchSuggestions(base: string, key: string): Promise<string[]> {
  const r = await fetch(`${base}/location/suggest`, {
    headers: { "x-app-key": key },
  });
  if (!r.ok) return [];
  const data = await r.json();
  return data.suggestions ?? [];
}
```

- [ ] **Step 4: Commit**

```bash
git add app/lib/location.ts app/app.json
git commit -m "feat: add GPS background location task"
```

---

## Task 11: App — Settings GPS toggle

**Files:**
- Modify: `app/app/(tabs)/settings.tsx`

- [ ] **Step 1: Replace settings.tsx with GPS toggle added**

```tsx
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { storage } from "@/lib/storage";
import { useTheme, ThemeMode } from "@/lib/theme";
import { isLocationEnabled, enableLocation, disableLocation } from "@/lib/location";

const MODES: ThemeMode[] = ["chaos", "dark", "calm", "red_alert"];

export default function Settings() {
  const { mode, set, palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [base, setBase] = useState("");
  const [key, setKey] = useState("");
  const [locationOn, setLocationOn] = useState(false);

  useEffect(() => {
    storage.getBase().then(setBase);
    storage.getKey().then(setKey);
    isLocationEnabled().then(setLocationOn);
  }, []);

  async function save() {
    await storage.setBase(base.trim());
    await storage.setKey(key.trim());
    Alert.alert("ok", "đã lưu");
  }

  async function toggleLocation(value: boolean) {
    if (value) {
      const ok = await enableLocation();
      if (!ok) {
        Alert.alert(
          "Không thể bật",
          "Bạn của Kem cần quyền truy cập vị trí. Vui lòng cấp quyền trong Cài đặt."
        );
        return;
      }
    } else {
      await disableLocation();
    }
    setLocationOn(value);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 12 }}
    >
      <Text style={{ color: palette.fg, fontSize: 14 }}>Backend URL</Text>
      <TextInput value={base} onChangeText={setBase} autoCapitalize="none"
        style={{ color: palette.fg, backgroundColor: "#222", padding: 10, borderRadius: 8 }} />
      <Text style={{ color: palette.fg, fontSize: 14 }}>App Key</Text>
      <TextInput value={key} onChangeText={setKey} autoCapitalize="none" secureTextEntry
        style={{ color: palette.fg, backgroundColor: "#222", padding: 10, borderRadius: 8 }} />
      <Pressable onPress={save} style={{ backgroundColor: palette.accent, padding: 12, borderRadius: 8 }}>
        <Text style={{ color: palette.fg, textAlign: "center" }}>Lưu</Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: "#111", padding: 12, borderRadius: 8, marginTop: 8 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ color: palette.fg, fontSize: 14 }}>Cho Bạn của Kem biết vị trí</Text>
          <Text style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
            Bạn của Kem sẽ gợi ý hoạt động và địa điểm phù hợp với tâm trạng của bạn
          </Text>
        </View>
        <Switch
          value={locationOn}
          onValueChange={toggleLocation}
          trackColor={{ false: "#333", true: palette.accent }}
          thumbColor={locationOn ? "#fff" : "#888"}
        />
      </View>

      <Text style={{ color: palette.fg, marginTop: 8 }}>Theme</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MODES.map(m => (
          <Pressable key={m} onPress={() => set(m)}
            style={{ padding: 8, borderRadius: 6, backgroundColor: m === mode ? palette.accent : "#222" }}>
            <Text style={{ color: palette.fg }}>{m}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/app/(tabs)/settings.tsx"
git commit -m "feat: add GPS location toggle to settings"
```

---

## Task 12: App — Suggestion card in chat screen

**Files:**
- Modify: `app/app/(tabs)/index.tsx`

- [ ] **Step 1: Add suggestion card to chat screen**

In `app/app/(tabs)/index.tsx`, add these imports at the top alongside existing ones:

```tsx
import { Modal } from "react-native";
import { isLocationEnabled, fetchSuggestions } from "@/lib/location";
```

Add state variables inside the `Chat` component (after existing useState declarations):

```tsx
const [showSuggest, setShowSuggest] = useState(false);
const [suggestions, setSuggestions] = useState<string[]>([]);
const [suggestLoading, setSuggestLoading] = useState(false);
const [locationEnabled, setLocationEnabled] = useState(false);
```

Add a useEffect to check location status (after the existing FIRST_RUN useEffect):

```tsx
useEffect(() => {
  isLocationEnabled().then(setLocationEnabled);
}, []);
```

Add this handler function inside the component (after the `send` function):

```tsx
async function openSuggestions() {
  setShowSuggest(true);
  setSuggestLoading(true);
  const base = await storage.getBase();
  const key = await storage.getKey();
  const list = await fetchSuggestions(base, key);
  setSuggestions(list);
  setSuggestLoading(false);
}
```

Add the suggestion button and modal just before the closing `</KeyboardAvoidingView>` tag:

```tsx
{locationEnabled && (
  <Pressable
    onPress={openSuggestions}
    style={{ margin: 8, padding: 10, backgroundColor: "#111", borderRadius: 8,
      borderWidth: 1, borderColor: "#222", alignItems: "center" }}
  >
    <Text style={{ color: palette.accent, fontSize: 12 }}>
      ✨ Bạn của Kem gợi ý cho hôm nay
    </Text>
  </Pressable>
)}

<Modal visible={showSuggest} transparent animationType="slide"
  onRequestClose={() => setShowSuggest(false)}>
  <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}
    onPress={() => setShowSuggest(false)}>
    <View style={{ backgroundColor: "#111", borderTopLeftRadius: 16, borderTopRightRadius: 16,
      padding: 20, minHeight: 180 }} onStartShouldSetResponder={() => true}>
      <Text style={{ color: palette.fg, fontSize: 15, marginBottom: 12 }}>
        Bạn của Kem gợi ý ✨
      </Text>
      {suggestLoading ? (
        <Text style={{ color: "#666" }}>Đang tìm gợi ý...</Text>
      ) : suggestions.length === 0 ? (
        <Text style={{ color: "#666" }}>Không có gợi ý nào lúc này.</Text>
      ) : (
        suggestions.map((s, i) => (
          <Text key={i} style={{ color: palette.fg, marginBottom: 8, lineHeight: 20 }}>{s}</Text>
        ))
      )}
    </View>
  </Pressable>
</Modal>
```

- [ ] **Step 2: Add storage import if not already present**

`storage` is already imported via `SecureStore` — but `fetchSuggestions` needs the base/key. Make sure `storage` is imported:

```tsx
import { storage } from "@/lib/storage";
```

(Add this if it's not already in the imports of index.tsx.)

- [ ] **Step 3: Commit**

```bash
git add "app/app/(tabs)/index.tsx"
git commit -m "feat: add location suggestion card to chat screen"
```

---

## Task 13: Final test run + deploy check

- [ ] **Step 1: Run all backend tests**

```bash
cd backend
python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 2: Verify backend starts**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Check:
- `GET http://localhost:8000/health` → `{"ok":true}`
- `GET http://localhost:8000/admin` → HTML dashboard loads
- `GET http://localhost:8000/admin` → login screen visible in browser

- [ ] **Step 3: Add ADMIN_KEY to Railway environment**

In Railway dashboard, add env var `ADMIN_KEY=<your-secret>` to the backend service.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: admin dashboard + GPS location feature complete"
```

---

## Self-Review

**Spec coverage check:**
- ✓ Admin dashboard at `/admin` with ADMIN_KEY auth
- ✓ Push noti manually from dashboard
- ✓ GPS map (Leaflet) with time-colored markers
- ✓ Chat log paginated
- ✓ Mood + status log
- ✓ GPS background tracking (expo-location, 15 min)
- ✓ Neutral framing for permission ("Bạn của Kem muốn biết...")
- ✓ Overpass API for POI lookup
- ✓ Claude Haiku generates suggestions with mood + POI context
- ✓ Suggestion card in chat screen (only when location enabled)
- ✓ Settings toggle to enable/disable GPS
- ✓ Dashboard polls every 30 seconds
- ✓ Deploy: ADMIN_KEY added to Railway

**Type consistency check:**
- `TOKEN_FILE` defined in both `routes/push.py` and `routes/admin.py` independently (intentional — each owns its own reference)
- `_check_admin` / `_check_key` naming consistent within each file
- `fetchSuggestions` in `location.ts` matches call site in `index.tsx`
- `LOCATION_ENABLED_KEY` constant defined once in `location.ts`, used internally
- `TASK_NAME` constant defined once at top of `location.ts`
