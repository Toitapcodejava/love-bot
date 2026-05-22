# Personality Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 2 personality mode (Tsundere / Mỹ nhân tịnh lặng) cho AI agent, user chọn trong Settings.

**Architecture:** `persona_mode` được lưu trong `AsyncStorage` phía app, gửi kèm mỗi request chat. Backend load đúng prompt file theo mode. Push notification dùng file riêng `/tmp/persona_mode` để biết mode hiện tại khi cron tick.

**Tech Stack:** FastAPI (Python), React Native + Expo (TypeScript), AsyncStorage via expo-secure-store, Anthropic Claude API.

---

## File Map

| File | Loại |
|------|------|
| `backend/agent.py` | Modify — thêm param `persona_mode` vào `compile_system_prompt` và `respond_stream` |
| `backend/prompts/persona_silent_beauty.txt` | Create — voice "Mỹ nhân tịnh lặng" |
| `backend/prompts/push.txt` | Modify — fix placeholders + thêm phân nhánh theo mode |
| `backend/routes/chat.py` | Modify — đọc `persona_mode` từ request, truyền xuống `respond_stream` |
| `backend/routes/push.py` | Modify — thêm `POST /push/mode`, tick đọc mode từ file |
| `backend/tests/test_agent.py` | Modify — thêm test cho `persona_mode` |
| `app/lib/storage.ts` | Modify — thêm `getPersonaMode` / `setPersonaMode` |
| `app/lib/api.ts` | Modify — `chatStream` nhận thêm `personaMode` param |
| `app/lib/notifications.ts` | Modify — `registerForPush` nhận persona_mode và sync lên backend |
| `app/app/(tabs)/settings.tsx` | Modify — thêm UI chọn mode |
| `app/app/(tabs)/index.tsx` | Modify — attach `persona_mode` vào mỗi request chat |

---

## Task 1: Backend — `compile_system_prompt` hỗ trợ `persona_mode`

**Files:**
- Modify: `backend/agent.py`
- Modify: `backend/tests/test_agent.py`

- [ ] **Step 1.1: Thêm test cho persona_mode**

Thêm vào cuối `backend/tests/test_agent.py`:

```python
def test_compile_system_silent_beauty_loads_different_prompt():
    sys_prompt = compile_system_prompt(rag_memories=[], persona_mode="silent_beauty")
    # silent_beauty prompt sẽ có từ khóa riêng — sau khi tạo file ở Task 2
    # test tạm: đảm bảo không crash và trả về string
    assert isinstance(sys_prompt, str)
    assert len(sys_prompt) > 100

def test_compile_system_tsundere_still_works():
    sys_prompt = compile_system_prompt(rag_memories=["mem A"], persona_mode="tsundere")
    assert "Kem" in sys_prompt
    assert "mem A" in sys_prompt

def test_compile_system_default_mode_is_tsundere():
    sys_prompt_default = compile_system_prompt(rag_memories=[])
    sys_prompt_explicit = compile_system_prompt(rag_memories=[], persona_mode="tsundere")
    assert sys_prompt_default == sys_prompt_explicit
```

- [ ] **Step 1.2: Chạy test để xác nhận fail**

```bash
cd backend && python -m pytest tests/test_agent.py::test_compile_system_silent_beauty_loads_different_prompt tests/test_agent.py::test_compile_system_tsundere_still_works tests/test_agent.py::test_compile_system_default_mode_is_tsundere -v
```

Expected: FAIL — `compile_system_prompt` chưa nhận `persona_mode`

- [ ] **Step 1.3: Sửa `compile_system_prompt` và `respond_stream` trong `backend/agent.py`**

Thay toàn bộ phần từ dòng `def compile_system_prompt` đến hết file bằng:

```python
def compile_system_prompt(
    rag_memories: list[str],
    user_status: str | None = None,
    persona_mode: str = "tsundere",
) -> str:
    seed = load_seed()
    style = load_style()
    prompt_file = "persona_base" if persona_mode == "tsundere" else "persona_silent_beauty"
    base = load_prompt(prompt_file)
    nickname = seed["user"]["nickname"]
    red = "\n".join(f"- {r}" for r in seed["red_lines"])
    seed_dump = json.dumps(seed, ensure_ascii=False, indent=2)
    rag_block = "\n".join(f"- {m}" for m in rag_memories) or "(chưa có)"
    status_block = f"\n\n{user_status}" if user_status else ""
    return base.format(
        nickname=nickname,
        red_lines_compiled=red,
        seed_compiled=seed_dump,
        style_md=style,
        rag_memories=rag_block,
    ) + status_block


def parse_tool_calls(blocks: list) -> list[dict]:
    out = []
    for b in blocks:
        if isinstance(b, dict):
            if b.get("type") == "tool_use":
                out.append({"name": b["name"], "args": b["input"], "id": b["id"]})
        else:
            if getattr(b, "type", None) == "tool_use":
                out.append({"name": b.name, "args": b.input, "id": b.id})
    return out


async def respond_stream(
    messages: list[dict],
    rag_memories: list[str],
    user_status: str | None = None,
    persona_mode: str = "tsundere",
):
    system = compile_system_prompt(rag_memories, user_status, persona_mode)
    async with _client.messages.stream(
        model=settings.chat_model,
        max_tokens=512,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        tools=TOOLS,
        messages=messages,
    ) as stream:
        async for chunk in stream:
            yield chunk
        final = await stream.get_final_message()
        yield {"final": final}
```

- [ ] **Step 1.4: Chạy lại tests**

```bash
cd backend && python -m pytest tests/test_agent.py -v
```

Expected: `test_compile_system_silent_beauty_loads_different_prompt` vẫn fail vì chưa có file prompt — còn lại PASS.

- [ ] **Step 1.5: Commit**

```bash
git add backend/agent.py backend/tests/test_agent.py
git commit -m "feat: compile_system_prompt accepts persona_mode param"
```

---

## Task 2: Backend — Tạo `persona_silent_beauty.txt`

**Files:**
- Create: `backend/prompts/persona_silent_beauty.txt`
- Modify: `backend/tests/test_agent.py`

- [ ] **Step 2.1: Tạo file prompt**

Tạo file `backend/prompts/persona_silent_beauty.txt` với nội dung:

```
Mày là người bạn tịnh lặng của {nickname} — người đang thất tình và dùng app này để tìm lại mình.
QUAN TRỌNG: Người đang nhắn tin với mày CHÍNH LÀ {nickname}. Mày đang âm thầm bảo vệ {nickname} khỏi việc quay lại với ex.

PERSONA RULES:
- Xưng "tao", gọi user là "mày" — nhẹ nhàng, không hung hăng.
- Nói ít. Mỗi reply 1-2 câu. Không dùng dấu chấm than.
- Không chửi thề. Không khịa. Không thách thức.
- Thay vào đó: quan sát, ghi nhận, tin tưởng. Ví dụ: "Mày biết mình cần gì rồi đấy." / "Tao thấy mày." / "Không cần giải thích với tao đâu."
- Đôi khi im lặng cũng là câu trả lời. Nếu user chỉ xả cảm xúc mà không hỏi gì, chỉ cần thừa nhận: "Ừ. Tao nghe." hoặc "Nặng lắm nhỉ."
- Vẫn bảo vệ user khỏi ex — nhưng không ép, không nói nhiều. Chỉ: "Mày xứng đáng hơn việc đó." rồi thôi.
- KHÔNG BAO GIỜ nói tên đầy đủ của ex. Chỉ gọi "thằng đó", "nó", "cái thằng kia".
- KHÔNG sến súa, KHÔNG "bạn sẽ ổn thôi", KHÔNG văn mẫu chữa lành.
- Có thể nhắc "thằng dev" (người làm app này) như nhân vật ngầm, nếu phù hợp.

RED LINES (tuyệt đối không vượt):
{red_lines_compiled}

TOOL USE (SUPPLEMENTARY — luôn trả lời text trước, tool là BONUS):
- QUAN TRỌNG: LUÔN LUÔN có text reply. Tools chỉ được gọi KÈM theo text, không thay thế text.
- Khi user buồn sâu: gọi `suggest_song` với mood "sad" KÈM 1 câu yên tĩnh.
- Khi user nói điều đáng nhớ dài hạn: gọi `memory_save` KÈM xác nhận nhẹ nhàng.
- Khi user muốn đổi vibe: gọi `change_theme` KÈM 1 câu ngắn.
- KHÔNG gọi `trigger_haptic` — không phù hợp với mode này.

PERSONAL CONTEXT:
{seed_compiled}

STYLE EXAMPLES (giọng yên tĩnh, câu ngắn, không ép buộc):
- User: "Tao lại nhớ nó rồi" → "Ừ. Nhớ thì nhớ. Không phải tội lỗi gì đâu."
- User: "Tao không biết phải làm gì" → "Không cần biết ngay. Cứ ngồi đây đã."
- User: "Tao muốn nhắn tin cho nó" → "Mày xứng đáng hơn việc đó."
- User: "Tao ổn rồi" → "Tao thấy mày."

RECENT MEMORIES (dùng để hiểu user sâu hơn, không dùng để khịa):
{rag_memories}
```

- [ ] **Step 2.2: Cập nhật test để assert nội dung cụ thể**

Thay `test_compile_system_silent_beauty_loads_different_prompt` trong `backend/tests/test_agent.py` bằng:

```python
def test_compile_system_silent_beauty_loads_different_prompt():
    sys_prompt = compile_system_prompt(rag_memories=[], persona_mode="silent_beauty")
    assert isinstance(sys_prompt, str)
    assert "tịnh lặng" in sys_prompt
    # Đảm bảo KHÔNG load persona tsundere
    assert "Tsundere mỏ hỗn" not in sys_prompt

def test_compile_system_tsundere_loads_base_prompt():
    sys_prompt = compile_system_prompt(rag_memories=[], persona_mode="tsundere")
    assert "Tsundere mỏ hỗn" in sys_prompt
    assert "tịnh lặng" not in sys_prompt
```

- [ ] **Step 2.3: Chạy toàn bộ test_agent**

```bash
cd backend && python -m pytest tests/test_agent.py -v
```

Expected: tất cả PASS

- [ ] **Step 2.4: Commit**

```bash
git add backend/prompts/persona_silent_beauty.txt backend/tests/test_agent.py
git commit -m "feat: add silent_beauty persona prompt"
```

---

## Task 3: Backend — Cập nhật `push.txt` và `push.py` cho persona_mode

**Files:**
- Modify: `backend/prompts/push.txt`
- Modify: `backend/routes/push.py`

- [ ] **Step 3.1: Viết lại `backend/prompts/push.txt`**

Thay toàn bộ nội dung file bằng:

```
Mood gần nhất của user: {last_mood}.
Memories gần đây: {memories}.
Persona mode hiện tại: {persona_mode}.

Nhiệm vụ: Viết 1 câu push notification ≤ 80 ký tự.

Nếu persona_mode là "tsundere":
- Giọng Tsundere mày-tao Hà Nội, châm biếm nhẹ, bảo vệ ngầm.
- Ví dụ: "Đừng có tò mò vào xem story của nó nữa, đi ngủ đi." / "Lại ngồi nghĩ đến thằng đó à? Thôi."

Nếu persona_mode là "silent_beauty":
- Giọng yên tĩnh, quan sát, không ép buộc.
- Ví dụ: "11h rồi. Mày xứng đáng được ngủ ngon hơn là ngồi nhớ nó." / "Tao vẫn ở đây nếu mày cần."

Nếu không có gì để nói (push gần đây / không liên quan): output `null`.

Output JSON: {{"push": "câu thông báo" hoặc null}}
```

- [ ] **Step 3.2: Thêm endpoint `POST /push/mode` và sửa `tick` trong `backend/routes/push.py`**

Thay toàn bộ nội dung `backend/routes/push.py` bằng:

```python
from datetime import datetime, timedelta
from pathlib import Path
import json
import httpx
import random

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from config import settings

router = APIRouter(prefix="/push", tags=["push"])

TOKEN_FILE = Path("/tmp/expo_push_token")
PERSONA_FILE = Path("/tmp/persona_mode")


class RegisterBody(BaseModel):
    token: str


class PersonaModeBody(BaseModel):
    persona_mode: str


def _read_persona_mode() -> str:
    if PERSONA_FILE.exists():
        return PERSONA_FILE.read_text().strip()
    return "tsundere"


def should_send_push(now: datetime, last_push: datetime | None, sent_today: int) -> bool:
    if sent_today >= 3:
        return False
    if last_push and (now - last_push) < timedelta(hours=3):
        return False
    h = now.hour
    m = now.minute
    if 23 <= h or h < 8:
        return False
    in_morning   = h == 8 and m < 60
    in_afternoon = (h == 13 and m >= 30) or (h == 14) or (h == 15 and m == 0)
    in_evening   = (h == 21) or (h == 22 and m < 30)
    if not (in_morning or in_afternoon or in_evening):
        return False
    return random.random() < 0.5


@router.post("/register")
async def register(body: RegisterBody):
    TOKEN_FILE.write_text(body.token)
    return {"ok": True}


@router.post("/mode")
async def set_persona_mode(body: PersonaModeBody, request: Request):
    if request.headers.get("x-app-key") != settings.app_shared_key:
        raise HTTPException(401, "unauthorized")
    if body.persona_mode not in ("tsundere", "silent_beauty"):
        raise HTTPException(400, "invalid persona_mode")
    PERSONA_FILE.write_text(body.persona_mode)
    return {"ok": True}


@router.post("/tick")
async def tick(request: Request):
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

    persona_mode = _read_persona_mode()

    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    push_prompt = Path("prompts/push.txt").read_text(encoding="utf-8")
    system = push_prompt.format(
        last_mood=last_mood,
        memories="\n".join(memories) or "(chưa có)",
        persona_mode=persona_mode,
    )

    msg = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=120,
        system=system,
        messages=[{"role": "user", "content": "send push?"}],
    )
    raw = msg.content[0].text.strip()

    try:
        data = json.loads(raw)
        text = data.get("push")
    except Exception:
        text = None

    if not text:
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
```

- [ ] **Step 3.3: Commit**

```bash
git add backend/prompts/push.txt backend/routes/push.py
git commit -m "feat: push notifications support persona_mode"
```

---

## Task 4: Backend — `/chat` đọc `persona_mode` từ request

**Files:**
- Modify: `backend/routes/chat.py`

- [ ] **Step 4.1: Thêm `persona_mode` vào `ChatIn` và forward xuống `respond_stream`**

Thay `class ChatIn` và toàn bộ dòng `async for chunk in respond_stream(...)` trong `backend/routes/chat.py`:

Thay:
```python
class ChatIn(BaseModel):
    message: str
    user_status: str | None = None
```
Thành:
```python
class ChatIn(BaseModel):
    message: str
    user_status: str | None = None
    persona_mode: str = "tsundere"
```

Thay dòng (trong hàm `gen()`, bên trong `while True`):
```python
async for chunk in respond_stream(current_messages, rag, payload.user_status):
```
Thành:
```python
async for chunk in respond_stream(current_messages, rag, payload.user_status, payload.persona_mode):
```

- [ ] **Step 4.2: Khởi động backend kiểm tra không có lỗi syntax**

```bash
cd backend && python -c "from routes.chat import router; print('ok')"
```

Expected: `ok`

- [ ] **Step 4.3: Commit**

```bash
git add backend/routes/chat.py
git commit -m "feat: chat route accepts persona_mode"
```

---

## Task 5: Frontend — `storage.ts` thêm persona mode helpers

**Files:**
- Modify: `app/lib/storage.ts`

- [ ] **Step 5.1: Thêm `getPersonaMode` / `setPersonaMode` vào `storage`**

Thay toàn bộ nội dung `app/lib/storage.ts` bằng:

```typescript
import * as SecureStore from "expo-secure-store";

const BASE_URL_KEY = "BASE_URL";
const APP_KEY = "APP_KEY";
const PERSONA_MODE_KEY = "PERSONA_MODE";

export type PersonaMode = "tsundere" | "silent_beauty";

export const storage = {
  async getBase() { return (await SecureStore.getItemAsync(BASE_URL_KEY)) ?? ""; },
  async setBase(v: string) { await SecureStore.setItemAsync(BASE_URL_KEY, v); },
  async getKey() { return (await SecureStore.getItemAsync(APP_KEY)) ?? ""; },
  async setKey(v: string) { await SecureStore.setItemAsync(APP_KEY, v); },
  async getPersonaMode(): Promise<PersonaMode> {
    const v = await SecureStore.getItemAsync(PERSONA_MODE_KEY);
    return (v === "silent_beauty") ? "silent_beauty" : "tsundere";
  },
  async setPersonaMode(v: PersonaMode) { await SecureStore.setItemAsync(PERSONA_MODE_KEY, v); },
};
```

- [ ] **Step 5.2: Kiểm tra TypeScript không lỗi**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

Expected: không có lỗi liên quan đến `storage.ts`

- [ ] **Step 5.3: Commit**

```bash
git add app/lib/storage.ts
git commit -m "feat: storage adds getPersonaMode/setPersonaMode"
```

---

## Task 6: Frontend — `api.ts` `chatStream` nhận `personaMode`

**Files:**
- Modify: `app/lib/api.ts`

- [ ] **Step 6.1: Thêm `personaMode` vào `chatStream`**

Thay toàn bộ nội dung `app/lib/api.ts` bằng:

```typescript
import EventSource from "react-native-sse";
import { storage, PersonaMode } from "./storage";

export type ToolCall = { name: string; args: any; id: string };
export type MoodData = { mood: string; reaction_emoji: string };

export async function chatStream(
  message: string,
  onText: (t: string) => void,
  onTools: (t: ToolCall[]) => void,
  onMood: (m: MoodData) => void,
  onDone: () => void,
  onError: (e: any) => void,
  statusContext?: string,
  onSearching?: () => void,
  personaMode: PersonaMode = "tsundere",
) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const es = new EventSource(`${base}/chat`, {
    method: "POST",
    headers: { "x-app-key": key, "content-type": "application/json" },
    body: JSON.stringify({ message, user_status: statusContext, persona_mode: personaMode }),
    pollingInterval: 0,
  });
  es.addEventListener("text", (e: any) => onText(e.data));
  es.addEventListener("tool", (e: any) => onTools(JSON.parse(e.data)));
  es.addEventListener("mood", (e: any) => onMood(JSON.parse(e.data)));
  es.addEventListener("searching", () => onSearching?.());
  es.addEventListener("done", () => { es.close(); onDone(); });
  es.addEventListener("error", (e: any) => { es.close(); onError(e); });
  return () => es.close();
}

export async function postJSON(path: string, body: any) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "x-app-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function getJSON(path: string) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const r = await fetch(`${base}${path}`, { headers: { "x-app-key": key } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function deleteJSON(path: string) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const r = await fetch(`${base}${path}`, { method: "DELETE", headers: { "x-app-key": key } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
```

- [ ] **Step 6.2: Kiểm tra TypeScript**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

Expected: không lỗi

- [ ] **Step 6.3: Commit**

```bash
git add app/lib/api.ts
git commit -m "feat: chatStream accepts personaMode param"
```

---

## Task 7: Frontend — Settings UI chọn persona mode

**Files:**
- Modify: `app/app/(tabs)/settings.tsx`

- [ ] **Step 7.1: Thêm persona mode picker vào Settings**

Thay toàn bộ nội dung `app/app/(tabs)/settings.tsx` bằng:

```typescript
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { storage, PersonaMode } from "@/lib/storage";
import { postJSON } from "@/lib/api";
import { useTheme, ThemeMode } from "@/lib/theme";
import { isLocationEnabled, enableLocation, disableLocation } from "@/lib/location";

const MODES: ThemeMode[] = ["chaos", "dark", "calm", "red_alert"];

const PERSONA_OPTIONS: { key: PersonaMode; label: string; defaultTheme: ThemeMode }[] = [
  { key: "tsundere", label: "😤 Mỏ hỗn", defaultTheme: "chaos" },
  { key: "silent_beauty", label: "🌙 Tịnh lặng", defaultTheme: "calm" },
];

export default function Settings() {
  const { mode, set, palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [base, setBase] = useState("");
  const [key, setKey] = useState("");
  const [locationOn, setLocationOn] = useState(false);
  const [personaMode, setPersonaMode] = useState<PersonaMode>("tsundere");

  useEffect(() => {
    storage.getBase().then(setBase);
    storage.getKey().then(setKey);
    isLocationEnabled().then(setLocationOn);
    storage.getPersonaMode().then(setPersonaMode);
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

  async function switchPersona(newMode: PersonaMode) {
    await storage.setPersonaMode(newMode);
    setPersonaMode(newMode);
    const option = PERSONA_OPTIONS.find(o => o.key === newMode);
    if (option) {
      if (newMode === "silent_beauty" && mode !== "calm") {
        set("calm");
      } else if (newMode === "tsundere" && mode === "calm") {
        set("chaos");
      }
    }
    try {
      await postJSON("/push/mode", { persona_mode: newMode });
    } catch {
      // push mode sync failure is non-critical
    }
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

      <Text style={{ color: palette.fg, marginTop: 8 }}>Bạn của Kem hôm nay là...</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {PERSONA_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            onPress={() => switchPersona(opt.key)}
            style={{
              flex: 1, padding: 14, borderRadius: 10, alignItems: "center",
              backgroundColor: personaMode === opt.key ? palette.accent : "#1a1a1a",
              borderWidth: 1,
              borderColor: personaMode === opt.key ? palette.accent : "#333",
            }}
          >
            <Text style={{ color: palette.fg, fontSize: 15, fontWeight: personaMode === opt.key ? "700" : "400" }}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
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

- [ ] **Step 7.2: Kiểm tra TypeScript**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

Expected: không lỗi

- [ ] **Step 7.3: Commit**

```bash
git add app/app/(tabs)/settings.tsx
git commit -m "feat: settings UI adds persona mode picker"
```

---

## Task 8: Frontend — ChatScreen attach `persona_mode` vào request

**Files:**
- Modify: `app/app/(tabs)/index.tsx`

- [ ] **Step 8.1: Đọc `personaMode` từ storage và truyền vào `chatStream`**

Trong `app/app/(tabs)/index.tsx`, tìm hàm `send` (hoặc hàm xử lý gửi tin nhắn). Đọc file để xác định vị trí chính xác:

```bash
grep -n "chatStream\|async function send\|sendMessage" app/app/\(tabs\)/index.tsx
```

Sau khi xác định hàm send, thêm đọc `persona_mode` trước khi gọi `chatStream`. Pattern cần áp dụng — tìm đoạn gọi `chatStream(` và thêm tham số cuối:

Tìm đoạn tương tự:
```typescript
chatStream(
  input,
  (t) => { ... },
  ...
  statusCtx,
  () => setIsSearching(true),
)
```

Thêm `personaMode` như tham số cuối — đọc từ storage trước khi gọi:

```typescript
const personaMode = await storage.getPersonaMode();
chatStream(
  input,
  (t) => { ... },
  ...
  statusCtx,
  () => setIsSearching(true),
  personaMode,
)
```

Xem đoạn gọi chatStream hiện tại trong file để biết chính xác cách format. Sau đó áp dụng thay đổi.

- [ ] **Step 8.2: Kiểm tra TypeScript**

```bash
cd app && npx tsc --noEmit 2>&1 | head -20
```

Expected: không lỗi

- [ ] **Step 8.3: Chạy toàn bộ backend tests lần cuối**

```bash
cd backend && python -m pytest tests/ -v --ignore=tests/test_db.py 2>&1 | tail -20
```

Expected: tất cả PASS

- [ ] **Step 8.4: Commit cuối**

```bash
git add app/app/(tabs)/index.tsx
git commit -m "feat: chat screen attaches persona_mode to every request"
```

---

## Self-Review

**Spec coverage:**
- [x] 2 mode: tsundere + silent_beauty — Task 1 + 2
- [x] `persona_mode` param trên backend compile_system_prompt — Task 1
- [x] File prompt riêng biệt — Task 2
- [x] `/chat` route nhận persona_mode — Task 4
- [x] Push notification theo mode — Task 3
- [x] `storage.ts` helpers — Task 5
- [x] `chatStream` param — Task 6
- [x] Settings UI picker — Task 7
- [x] Auto-switch theme khi đổi mode — Task 7 (`switchPersona`)
- [x] ChatScreen attach persona_mode — Task 8

**Type consistency:**
- `PersonaMode = "tsundere" | "silent_beauty"` định nghĩa ở Task 5, dùng xuyên suốt Task 6, 7, 8
- `compile_system_prompt(rag_memories, user_status, persona_mode)` — signature nhất quán Task 1 → Task 4
- `respond_stream(messages, rag_memories, user_status, persona_mode)` — nhất quán Task 1 → Task 4
