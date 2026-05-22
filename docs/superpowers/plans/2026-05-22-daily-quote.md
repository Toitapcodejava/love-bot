# Daily Quote Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị quote động viên full-screen mỗi khi mở app — chỉ khi persona là `silent_beauty`.

**Architecture:** Backend có endpoint `GET /api/quotes/daily` trả về một quote ngẫu nhiên từ batch 5 quotes được gen bằng Claude theo giọng silent_beauty và cache theo ngày. App đọc `persona_mode` từ AsyncStorage, nếu là `silent_beauty` thì fetch quote và show `QuoteModal` trước khi user vào tabs. Tap bất kỳ đâu để dismiss. Nếu fetch fail hoặc timeout 3s thì skip modal hoàn toàn.

**Tech Stack:** FastAPI + Anthropic Claude API (backend), React Native + Expo (app), `expo-linear-gradient` (gradient UI), AsyncStorage qua `expo-secure-store` (đã có trong `app/lib/storage.ts`).

**Dependency note:** Plan này giả sử `storage.getPersonaMode()` đã tồn tại (được implement trong personality-mode plan). Nếu chưa có, Task 1 có bước tạo tạm.

---

## File Map

| File | Loại |
|------|------|
| `backend/prompts/quote_prompt.txt` | Create — prompt gen 5 quotes theo giọng silent_beauty |
| `backend/routes/quotes.py` | Create — endpoint `GET /api/quotes/daily` + cache logic |
| `backend/data/quotes_cache.json` | Create (auto) — cache ngày/batch, tạo rỗng khi khởi động |
| `backend/main.py` | Modify — mount quotes router |
| `app/components/QuoteModal.tsx` | Create — full-screen modal gradient, tap to dismiss |
| `app/app/_layout.tsx` | Modify — fetch quote + show QuoteModal trước CheckInModal |

---

## Task 1: Backend — Prompt file và cache skeleton

**Files:**
- Create: `backend/prompts/quote_prompt.txt`
- Create: `backend/data/quotes_cache.json`

- [ ] **Step 1.1: Tạo thư mục data nếu chưa có**

```bash
mkdir -p backend/data
```

- [ ] **Step 1.2: Tạo `backend/data/quotes_cache.json` rỗng**

```json
{}
```

- [ ] **Step 1.3: Tạo `backend/prompts/quote_prompt.txt`**

Nội dung:

```
Mày là Mỹ nhân tịnh lặng — người bạn đã trải qua nhiều, nói ít, không chửi thề, không toxic positivity.
Viết đúng 5 câu động viên ngắn cho người đang thất tình. Mỗi câu một dòng riêng.
Giọng: nhẹ, quan sát, câu ngắn, không dấu chấm than, không nhắc ex.
Ví dụ giọng đúng: "Không cần vội. Mày đang ổn hơn mày nghĩ."
Chỉ trả về 5 dòng, không đánh số, không giải thích thêm.
```

- [ ] **Step 1.4: Commit**

```bash
git add backend/prompts/quote_prompt.txt backend/data/quotes_cache.json
git commit -m "feat: add quote prompt and cache skeleton"
```

---

## Task 2: Backend — Endpoint `/api/quotes/daily`

**Files:**
- Create: `backend/routes/quotes.py`
- Modify: `backend/main.py`

- [ ] **Step 2.1: Tạo `backend/routes/quotes.py`**

```python
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
```

- [ ] **Step 2.2: Mount router trong `backend/main.py`**

Thêm 2 dòng vào `backend/main.py`:

```python
# Thêm vào phần import (sau dòng from routes.admin import router as admin_router):
from routes.quotes import router as quotes_router

# Thêm vào phần include_router (sau app.include_router(admin_router)):
app.include_router(quotes_router)
```

File đầy đủ sau khi sửa:

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
from routes.quotes import router as quotes_router


@asynccontextmanager
async def lifespan(app):
    pool = await get_pool()
    await run_migrations(pool)
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
app.include_router(quotes_router)


@app.get("/health")
async def health():
    return {"ok": True}
```

- [ ] **Step 2.3: Test endpoint thủ công**

Start backend:
```bash
cd backend && uvicorn main:app --reload
```

Gọi endpoint:
```bash
curl http://localhost:8000/api/quotes/daily
```

Expected response:
```json
{"quote": "Không cần vội. Mày đang ổn hơn mày nghĩ."}
```

Gọi lần 2 — phải trả về từ cache (không gọi Claude nữa), response instant.

- [ ] **Step 2.4: Commit**

```bash
git add backend/routes/quotes.py backend/main.py
git commit -m "feat: add /api/quotes/daily endpoint with daily cache"
```

---

## Task 3: App — Component `QuoteModal`

**Files:**
- Create: `app/components/QuoteModal.tsx`

- [ ] **Step 3.1: Kiểm tra `expo-linear-gradient` đã có chưa**

```bash
cd app && grep "expo-linear-gradient" package.json
```

Nếu chưa có:
```bash
npx expo install expo-linear-gradient
```

- [ ] **Step 3.2: Tạo `app/components/QuoteModal.tsx`**

```tsx
import { Modal, Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface QuoteModalProps {
  visible: boolean;
  quote: string;
  onDismiss: () => void;
}

export function QuoteModal({ visible, quote, onDismiss }: QuoteModalProps) {
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent={false}>
      <Pressable style={styles.pressable} onPress={onDismiss}>
        <LinearGradient
          colors={["#1a1040", "#0d0d1f"]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <Text style={styles.moon}>🌙</Text>
            {quote ? (
              <Text style={styles.quote}>{quote}</Text>
            ) : (
              <ActivityIndicator color="#a89fcf" style={{ marginVertical: 16 }} />
            )}
            <Text style={styles.hint}>chạm để tiếp tục</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressable:  { flex: 1 },
  gradient:   { flex: 1, alignItems: "center", justifyContent: "center" },
  content:    { paddingHorizontal: 36, alignItems: "center", gap: 20 },
  moon:       { fontSize: 48 },
  quote:      { color: "#ddd8f0", fontSize: 20, fontStyle: "italic", textAlign: "center", lineHeight: 32 },
  hint:       { color: "#7c6fa0", fontSize: 12, marginTop: 8 },
});
```

- [ ] **Step 3.3: Commit**

```bash
git add app/components/QuoteModal.tsx
git commit -m "feat: add QuoteModal component"
```

---

## Task 4: App — Tích hợp vào `_layout.tsx`

**Files:**
- Modify: `app/app/_layout.tsx`

- [ ] **Step 4.1: Kiểm tra `getPersonaMode` trong storage**

```bash
grep "getPersonaMode\|PersonaMode\|persona" app/lib/storage.ts
```

Nếu `getPersonaMode` **chưa có** trong `app/lib/storage.ts`, thêm vào cuối file:

```ts
const PERSONA_MODE_KEY = "PERSONA_MODE";

export const personaStorage = {
  async getMode(): Promise<string> {
    return (await SecureStore.getItemAsync(PERSONA_MODE_KEY)) ?? "tsundere";
  },
  async setMode(v: string) {
    await SecureStore.setItemAsync(PERSONA_MODE_KEY, v);
  },
};
```

Nếu **đã có** (từ personality-mode plan), dùng function đó và bỏ qua bước này.

- [ ] **Step 4.2: Sửa `app/app/_layout.tsx`**

Thay toàn bộ nội dung file:

```tsx
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import "react-native-reanimated";

import { ThemeProvider, useTheme } from "@/lib/theme";
import { bindThemeSetter } from "@/lib/toolExecutor";
import { registerForPush } from "@/lib/notifications";
import { useUserStatus, isStale, UserStatus } from "@/lib/userStatus";
import { CheckInModal } from "@/components/CheckInModal";
import { QuoteModal } from "@/components/QuoteModal";
import { getJSON } from "@/lib/api";
import { storage } from "@/lib/storage";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = { initialRouteName: "(tabs)" };

SplashScreen.preventAutoHideAsync();

function WireTools() {
  const { set } = useTheme();
  useEffect(() => { bindThemeSetter(set); }, [set]);
  useEffect(() => { registerForPush(); }, []);
  return null;
}

function AppShell() {
  const { status, setStatus, loaded } = useUserStatus();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const pendingCheckIn = useRef(false);

  useEffect(() => {
    if (!loaded) return;

    async function initQuote() {
      try {
        const base = await storage.getBase();
        if (!base) return;

        // Đọc persona_mode — dùng SecureStore trực tiếp nếu personaStorage chưa có
        const { default: SecureStore } = await import("expo-secure-store");
        const mode = (await SecureStore.getItemAsync("PERSONA_MODE")) ?? "tsundere";

        if (mode !== "silent_beauty") {
          if (isStale(status)) setShowCheckIn(true);
          return;
        }

        // Hiện modal ngay (loading state) rồi fetch
        setShowQuote(true);
        pendingCheckIn.current = isStale(status);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
          const data = await getJSON("/api/quotes/daily");
          setQuoteText(data.quote ?? "");
        } catch {
          // timeout hoặc lỗi → đóng modal luôn
          setShowQuote(false);
          if (pendingCheckIn.current) setShowCheckIn(true);
          pendingCheckIn.current = false;
        } finally {
          clearTimeout(timeout);
        }
      } catch {
        if (isStale(status)) setShowCheckIn(true);
      }
    }

    initQuote();
  }, [loaded]);

  function handleQuoteDone() {
    setShowQuote(false);
    setQuoteText("");
    if (pendingCheckIn.current) {
      setShowCheckIn(true);
      pendingCheckIn.current = false;
    }
  }

  async function handleCheckInDone(s: UserStatus) {
    await setStatus(s);
    setShowCheckIn(false);
  }

  return (
    <>
      <WireTools />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        <Stack.Screen name="vent" options={{ headerShown: false }} />
      </Stack>
      <QuoteModal visible={showQuote} quote={quoteText} onDismiss={handleQuoteDone} />
      <CheckInModal visible={showCheckIn} onDone={handleCheckInDone} />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
```

- [ ] **Step 4.3: Commit**

```bash
git add app/app/_layout.tsx app/lib/storage.ts
git commit -m "feat: show QuoteModal on launch for silent_beauty persona"
```

---

## Task 5: Testing thủ công

**Files:** không thay đổi file

- [ ] **Step 5.1: Test persona silent_beauty — hiện quote**

1. Mở Settings → chọn persona `silent_beauty` (hoặc set thủ công qua SecureStore key `PERSONA_MODE` = `"silent_beauty"`)
2. Kill app hoàn toàn → mở lại
3. Expected: màn hình gradient tím-đen, emoji 🌙, quote italic xuất hiện
4. Tap bất kỳ → vào tabs bình thường

- [ ] **Step 5.2: Test persona tsundere — skip quote**

1. Đổi `PERSONA_MODE` = `"tsundere"` (hoặc xóa key → default)
2. Kill app → mở lại
3. Expected: không thấy modal, vào app thẳng

- [ ] **Step 5.3: Test offline — không block app**

1. Bật chế độ máy bay
2. Đổi `PERSONA_MODE` = `"silent_beauty"`
3. Kill app → mở lại
4. Expected: modal có thể hiện loading ngắn rồi tự skip (hoặc skip ngay), không bị kẹt

- [ ] **Step 5.4: Test cả quote + check-in cùng trigger**

1. Đặt `PERSONA_MODE` = `"silent_beauty"`, đảm bảo `userStatus` đã stale (xóa hoặc đặt timestamp cũ)
2. Kill app → mở lại
3. Expected: quote hiện trước → tap → check-in modal hiện tiếp

- [ ] **Step 5.5: Test cache hoạt động**

1. Gọi `GET /api/quotes/daily` hai lần liên tiếp
2. Lần 2 phải trả về ngay, không delay Claude
3. Kiểm tra `backend/data/quotes_cache.json` có entry cho ngày hôm nay với 5 quotes

- [ ] **Step 5.6: Commit cuối**

```bash
git add -A
git commit -m "feat: daily quote screen complete"
```
