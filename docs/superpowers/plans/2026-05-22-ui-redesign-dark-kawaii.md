# UI Redesign — Dark Kawaii + Character-First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến Kem thành một nhân vật có cảm xúc nhìn thấy được — Dark Kawaii palette, avatar emoji reactive, iMessage-style bubbles, mood system xuyên suốt chat → push notification.

**Architecture:** Backend phân loại mood sau mỗi lượt chat (Haiku call nhỏ), emit SSE event `mood` + `reaction_emoji` về frontend. Frontend lưu mood vào state, dùng để drive avatar badge, bubble, và tab Đập. Push notification đã có infrastructure — chỉ cần mood flow vào `mood_snapshots`.

**Tech Stack:** React Native / Expo 56, React Native Animated (built-in), FastAPI, asyncpg, Anthropic SDK (claude-haiku-4-5-20251001 cho mood classification)

---

## File Map

| File | Action | Trách nhiệm |
|------|--------|-------------|
| `app/lib/theme.tsx` | Modify | Dark Kawaii palette + `accent2` token |
| `app/components/Avatar.tsx` | Create | Avatar tròn + emoji badge + pulse khi streaming |
| `app/components/TypingIndicator.tsx` | Create | 3 chấm nhảy |
| `app/components/ChatBubble.tsx` | Modify | iMessage shape, gradient, slide-in, reaction emoji |
| `app/components/Weapon.tsx` | Modify | Bounce animation khi selected |
| `app/app/(tabs)/index.tsx` | Modify | Mood state, Avatar header, TypingIndicator, quick emoji, gradient send |
| `app/app/(tabs)/_layout.tsx` | Modify | Emoji tab icons + active indicator |
| `app/app/(tabs)/rage.tsx` | Modify | Mood=annoyed on enter, cập nhật màu |
| `backend/routes/chat.py` | Modify | Mood classification sau stream, emit `mood` + `reaction_emoji` SSE events, save to DB |
| `backend/routes/push.py` | Modify | Cập nhật schedule heuristic khớp spec (8h, 14h, 21h30) |

---

## Task 1: Dark Kawaii Palette

**Files:**
- Modify: `app/lib/theme.tsx`

- [ ] **Step 1: Cập nhật palette trong theme.tsx**

Thay toàn bộ nội dung `app/lib/theme.tsx`:

```tsx
import React, { createContext, useContext, useState } from "react";

export type ThemeMode = "chaos" | "dark" | "calm" | "red_alert";

const PALETTES: Record<ThemeMode, {
  bg: string; fg: string; accent: string; accent2: string;
  surface: string; border: string;
}> = {
  chaos:     { bg: "#0a0a0a", fg: "#ffffff", accent: "#ff2d55", accent2: "#ff6b6b", surface: "#222", border: "#333" },
  dark:      { bg: "#0d0d1a", fg: "#eaeaea", accent: "#7aa2f7", accent2: "#bb9af7", surface: "#1a1a2e", border: "#2a2a3e" },
  calm:      { bg: "#1a1a2e", fg: "#eaeaea", accent: "#7aa2f7", accent2: "#bb9af7", surface: "#16213e", border: "#2a2a4e" },
  red_alert: { bg: "#1a0000", fg: "#ffe5e5", accent: "#ff0000", accent2: "#ff4444", surface: "#2a0000", border: "#3a0000" },
};

const Ctx = createContext({
  mode: "dark" as ThemeMode,
  set: (_: ThemeMode) => {},
  palette: PALETTES.dark,
});

export function ThemeProvider({ children }: any) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  return (
    <Ctx.Provider value={{ mode, set: setMode, palette: PALETTES[mode] }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/theme.tsx
git commit -m "feat: Dark Kawaii palette — purple/blue accent, surface/border tokens"
```

---

## Task 2: Avatar Component

**Files:**
- Create: `app/components/Avatar.tsx`

- [ ] **Step 1: Tạo Avatar.tsx**

```tsx
import { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

export type Mood = "neutral" | "annoyed" | "concerned" | "smug" | "warm" | "thinking";

const MOOD_EMOJI: Record<Mood, string> = {
  neutral:   "😒",
  annoyed:   "😤",
  concerned: "🥺",
  smug:      "😏",
  warm:      "💜",
  thinking:  "🤔",
};

interface AvatarProps {
  mood: Mood;
  streaming: boolean;
  size?: number;
}

export function Avatar({ mood, streaming, size = 42 }: AvatarProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const prevMood = useRef<Mood>(mood);

  // Pulse glow khi streaming
  useEffect(() => {
    if (streaming) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [streaming]);

  // Badge pop khi mood đổi
  useEffect(() => {
    if (prevMood.current !== mood) {
      prevMood.current = mood;
      Animated.sequence([
        Animated.timing(badgeScale, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.spring(badgeScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [mood]);

  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });
  const glowScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const badgeSize = Math.round(size * 0.43);

  return (
    <View style={{ width: size + 16, height: size + 16, alignItems: "center", justifyContent: "center" }}>
      {/* Glow ring */}
      <Animated.View style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: (size + 16) / 2,
          backgroundColor: "#7aa2f7",
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }
      ]} />
      {/* Avatar circle */}
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        alignItems: "center", justifyContent: "center",
        // Gradient via layered views (RN không có LinearGradient built-in)
        backgroundColor: "#7aa2f7",
      }}>
        <View style={{
          position: "absolute", bottom: 0, right: 0, left: 0, top: size / 2,
          borderBottomLeftRadius: size / 2, borderBottomRightRadius: size / 2,
          backgroundColor: "#bb9af7",
        }} />
        <Text style={{ fontSize: size * 0.52 }}>🌙</Text>
      </View>
      {/* Emoji badge */}
      <Animated.View style={{
        position: "absolute", bottom: 2, right: 2,
        width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2,
        backgroundColor: "#0d0d1a", borderWidth: 1, borderColor: "#1a1a2e",
        alignItems: "center", justifyContent: "center",
        transform: [{ scale: badgeScale }],
      }}>
        <Text style={{ fontSize: badgeSize * 0.62 }}>{MOOD_EMOJI[mood]}</Text>
      </Animated.View>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/Avatar.tsx
git commit -m "feat: Avatar component — gradient circle, emoji badge reactive, pulse on stream"
```

---

## Task 3: TypingIndicator Component

**Files:**
- Create: `app/components/TypingIndicator.tsx`

- [ ] **Step 1: Tạo TypingIndicator.tsx**

```tsx
import { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

export function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0.2)).current,
                useRef(new Animated.Value(0.2)).current,
                useRef(new Animated.Value(0.2)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.2, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center", height: 16 }}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{
          width: 5, height: 5, borderRadius: 3,
          backgroundColor: "#7aa2f7",
          opacity: dot,
        }} />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/TypingIndicator.tsx
git commit -m "feat: TypingIndicator — 3 dots wave animation"
```

---

## Task 4: ChatBubble — iMessage Shape + Slide-in + Reaction Emoji

**Files:**
- Modify: `app/components/ChatBubble.tsx`

- [ ] **Step 1: Viết lại ChatBubble.tsx**

```tsx
import { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { useTheme } from "@/lib/theme";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  reactionEmoji?: string;
  isLatest?: boolean;
}

export function ChatBubble({ role, content, reactionEmoji, isLatest }: ChatBubbleProps) {
  const { palette } = useTheme();
  const isUser = role === "user";
  const slideAnim = useRef(new Animated.Value(isLatest ? (isUser ? 20 : -20) : 0)).current;
  const opacityAnim = useRef(new Animated.Value(isLatest ? 0 : 1)).current;

  useEffect(() => {
    if (isLatest) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, []);

  return (
    <View style={{ alignSelf: isUser ? "flex-end" : "flex-start", marginVertical: 3, maxWidth: "80%" }}>
      <Animated.View style={{
        transform: [{ translateX: slideAnim }],
        opacity: opacityAnim,
        backgroundColor: isUser ? "transparent" : palette.surface,
        borderRadius: isUser ? undefined : undefined,
        // iMessage shape
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: isUser ? 18 : 4,
        borderBottomRightRadius: isUser ? 4 : 18,
        // User bubble: gradient via layered background
        overflow: "hidden",
      }}>
        {isUser && (
          <View style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: palette.accent,
          }} />
        )}
        {isUser && (
          <View style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: "50%",
            backgroundColor: palette.accent2,
          }} />
        )}
        <Text style={{
          color: isUser ? "#fff" : palette.fg,
          padding: 10,
          paddingHorizontal: 14,
          fontSize: 14,
          lineHeight: 20,
        }}>
          {content}
        </Text>
      </Animated.View>
      {/* Reaction emoji dưới bubble Kem */}
      {!isUser && reactionEmoji && (
        <Text style={{ fontSize: 14, marginTop: 2, marginLeft: 6 }}>{reactionEmoji}</Text>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/ChatBubble.tsx
git commit -m "feat: ChatBubble — iMessage corners, slide-in animation, reaction emoji"
```

---

## Task 5: Backend — Mood Classification + SSE Events

**Files:**
- Modify: `backend/routes/chat.py`

- [ ] **Step 1: Thêm hàm classify_mood vào chat.py**

Thay toàn bộ `backend/routes/chat.py`:

```python
import asyncio
import json
from fastapi import APIRouter, Request, HTTPException
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from anthropic import AsyncAnthropic
from agent import respond_stream, parse_tool_calls
from memory import rag_top_k, recent_turns, save_turn, extract_and_save
from config import settings

router = APIRouter()

_classifier = AsyncAnthropic(api_key=settings.anthropic_api_key)

MOOD_SYSTEM = """You are a mood classifier. Given an assistant message, return JSON only.
Output format: {"mood": "<one of: neutral|annoyed|concerned|smug|warm|thinking>", "reaction_emoji": "<one emoji>"}
Rules:
- neutral: default, conversational
- annoyed: frustrated, sarcastic, impatient
- concerned: empathetic, worried about user
- smug: teasing, witty comeback
- warm: rare genuine care moment
- reaction_emoji: pick 1 emoji that fits the mood (💜 😒 😤 🥺 😏 ✨ 🙃 💙)
Return ONLY valid JSON, no explanation."""


async def classify_mood(ai_text: str) -> tuple[str, str]:
    try:
        msg = await _classifier.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=60,
            system=MOOD_SYSTEM,
            messages=[{"role": "user", "content": ai_text[:400]}],
        )
        data = json.loads(msg.content[0].text.strip())
        mood = data.get("mood", "neutral")
        emoji = data.get("reaction_emoji", "💜")
        if mood not in ("neutral", "annoyed", "concerned", "smug", "warm", "thinking"):
            mood = "neutral"
        return mood, emoji
    except Exception:
        return "neutral", "💜"


class ChatIn(BaseModel):
    message: str


@router.post("/chat")
async def chat(payload: ChatIn, request: Request):
    if request.headers.get("x-app-key") != settings.app_shared_key:
        raise HTTPException(401, "unauthorized")
    user_msg = payload.message
    rag = await rag_top_k(user_msg)
    history = await recent_turns(10)
    history.append({"role": "user", "content": user_msg})
    user_turn_id = await save_turn("user", user_msg)
    pool = request.app.state.pool

    async def gen():
        ai_text = ""
        tool_calls = []
        try:
            async for chunk in respond_stream(history, rag):
                if isinstance(chunk, dict) and "final" in chunk:
                    final = chunk["final"]
                    for b in final.content:
                        if getattr(b, "type", None) == "tool_use":
                            tool_calls.append({"name": b.name, "args": b.input, "id": b.id})
                    if tool_calls:
                        yield {"event": "tool", "data": json.dumps(tool_calls, ensure_ascii=False)}
                else:
                    if hasattr(chunk, "type") and chunk.type == "content_block_delta":
                        d = chunk.delta
                        if getattr(d, "type", None) == "text_delta":
                            ai_text += d.text
                            yield {"event": "text", "data": d.text}

            # Classify mood sau khi stream xong
            if ai_text:
                mood, reaction_emoji = await classify_mood(ai_text)
                yield {"event": "mood", "data": json.dumps({"mood": mood, "reaction_emoji": reaction_emoji})}

            yield {"event": "done", "data": ""}
        finally:
            if ai_text:
                ai_turn_id = await save_turn("assistant", ai_text)
                asyncio.create_task(extract_and_save(user_msg, ai_text, ai_turn_id))
                # Save mood snapshot
                if ai_text:
                    try:
                        mood_val, _ = await classify_mood(ai_text)
                        async with pool.acquire() as conn:
                            await conn.execute(
                                "INSERT INTO mood_snapshots (mood, trigger) VALUES ($1, $2)",
                                mood_val, "chat"
                            )
                    except Exception:
                        pass

    return EventSourceResponse(gen())
```

> **Lưu ý:** `classify_mood` được gọi 2 lần — một lần để emit SSE, một lần để save DB. Chấp nhận được vì Haiku rẻ và nhanh. Nếu muốn optimize sau, cache kết quả vào biến local.

- [ ] **Step 2: Chạy backend để verify không crash**

```bash
cd backend && python -m uvicorn main:app --reload --port 8000
```

Expected: server starts, no import errors.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/chat.py
git commit -m "feat(backend): mood classification after stream — emit mood+reaction_emoji SSE events"
```

---

## Task 6: Chat Screen — Mood State + New Header + Quick Emoji

**Files:**
- Modify: `app/app/(tabs)/index.tsx`
- Modify: `app/lib/api.ts`

- [ ] **Step 1: Thêm mood event handler vào api.ts**

Thêm `onMood` parameter vào `chatStream` trong `app/lib/api.ts`:

```ts
import EventSource from "react-native-sse";
import { storage } from "./storage";

export type ToolCall = { name: string; args: any; id: string };
export type MoodData = { mood: string; reaction_emoji: string };

export async function chatStream(
  message: string,
  onText: (t: string) => void,
  onTools: (t: ToolCall[]) => void,
  onMood: (m: MoodData) => void,
  onDone: () => void,
  onError: (e: any) => void,
) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const es = new EventSource(`${base}/chat`, {
    method: "POST",
    headers: { "x-app-key": key, "content-type": "application/json" },
    body: JSON.stringify({ message }),
    pollingInterval: 0,
  });
  es.addEventListener("text", (e: any) => onText(e.data));
  es.addEventListener("tool", (e: any) => onTools(JSON.parse(e.data)));
  es.addEventListener("mood", (e: any) => onMood(JSON.parse(e.data)));
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

- [ ] **Step 2: Viết lại index.tsx**

```tsx
import { useState, useRef, useEffect } from "react";
import {
  View, TextInput, Pressable, Text, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { chatStream, MoodData } from "@/lib/api";
import { ChatBubble } from "@/components/ChatBubble";
import { Avatar, Mood } from "@/components/Avatar";
import { TypingIndicator } from "@/components/TypingIndicator";
import { useTheme } from "@/lib/theme";
import { executeTools } from "@/lib/toolExecutor";

type Msg = {
  role: "user" | "assistant";
  content: string;
  reactionEmoji?: string;
};

const FIRST_RUN_KEY = "FIRST_RUN_DONE";

export default function Chat() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Lâu không thấy. Lại có chuyện gì rồi à?" }
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [mood, setMood] = useState<Mood>("neutral");
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const done = await SecureStore.getItemAsync(FIRST_RUN_KEY);
      if (!done) {
        setMsgs([{ role: "assistant", content: "Ờ. Thằng dev nó làm cái này cho mày. Đừng cảm động vội — tao là loại khó tính. Bắt đầu kể đi." }]);
        await SecureStore.setItemAsync(FIRST_RUN_KEY, "1");
      }
    })();
  }, []);

  async function send(text?: string) {
    const user = (text ?? input).trim();
    if (!user || streaming) return;
    setInput("");
    setMsgs(m => [...m, { role: "user", content: user }, { role: "assistant", content: "" }]);
    setStreaming(true);
    setMood("thinking");
    await chatStream(
      user,
      (t) => setMsgs(m => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + t };
        return copy;
      }),
      (tools) => executeTools(tools),
      (moodData: MoodData) => {
        setMood(moodData.mood as Mood);
        setMsgs(m => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], reactionEmoji: moodData.reaction_emoji };
          return copy;
        });
      },
      () => setStreaming(false),
      (e) => { console.error(e); setStreaming(false); setMood("neutral"); },
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: palette.bg }}
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top,
        backgroundColor: palette.bg,
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}>
        <Avatar mood={mood} streaming={streaming} size={42} />
        <View>
          <Text style={{ color: palette.fg, fontSize: 15, fontWeight: "700" }}>Kem</Text>
          {streaming
            ? <TypingIndicator />
            : <Text style={{ color: palette.accent, fontSize: 11 }}>● online</Text>
          }
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
      >
        {msgs.map((m, i) => (
          <ChatBubble
            key={i}
            role={m.role}
            content={m.content}
            reactionEmoji={m.reactionEmoji}
            isLatest={i === msgs.length - 1}
          />
        ))}
      </ScrollView>

      {/* Input bar */}
      <View style={{
        flexDirection: "row",
        padding: 10,
        paddingBottom: insets.bottom || 10,
        gap: 8,
        backgroundColor: palette.bg,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        alignItems: "flex-end",
      }}>
        {/* Quick emoji */}
        <TouchableOpacity onPress={() => send("😤")} style={{ paddingBottom: 6 }}>
          <Text style={{ fontSize: 22 }}>😤</Text>
        </TouchableOpacity>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="nói đi..."
          placeholderTextColor="#555"
          multiline
          style={{
            flex: 1,
            color: palette.fg,
            backgroundColor: palette.surface,
            padding: 10,
            borderRadius: 20,
            maxHeight: 100,
            borderWidth: 1,
            borderColor: palette.border,
          }}
          onSubmitEditing={() => send()}
        />

        {/* Send button — gradient via layered views */}
        <Pressable
          onPress={() => send()}
          disabled={streaming}
          style={{
            width: 42, height: 42, borderRadius: 21,
            alignItems: "center", justifyContent: "center",
            backgroundColor: streaming ? "#333" : palette.accent,
            overflow: "hidden",
          }}
        >
          {!streaming && (
            <View style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: "50%",
              backgroundColor: palette.accent2,
            }} />
          )}
          <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/api.ts app/app/\(tabs\)/index.tsx
git commit -m "feat: chat screen — mood state, Avatar header, TypingIndicator, quick emoji, gradient send"
```

---

## Task 7: Tab Bar — Emoji Icons + Active Indicator

**Files:**
- Modify: `app/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Viết lại _layout.tsx**

```tsx
import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useShakeNavigation } from "@/lib/shake";

const TAB_CONFIG = [
  { name: "index",    emoji: "💬", label: "Chat"    },
  { name: "memory",   emoji: "🔖", label: "Ký ức"   },
  { name: "rage",     emoji: "🔥", label: "Đập"     },
  { name: "settings", emoji: "⚙️", label: "Cài đặt" },
];

function EmojiTabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 4 }}>
      {focused && (
        <View style={{
          position: "absolute", top: -8, width: 20, height: 3,
          borderRadius: 2, backgroundColor: "#7aa2f7",
        }} />
      )}
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.35 }}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  useShakeNavigation();

  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: "#0a0a0a", borderTopColor: "#1a1a2e", borderTopWidth: 1 },
      tabBarActiveTintColor: "#7aa2f7",
      tabBarInactiveTintColor: "#555",
      tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      headerShown: false,
    }}>
      {TAB_CONFIG.map(tab => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{
          title: tab.label,
          tabBarIcon: ({ focused }) => (
            <EmojiTabIcon emoji={tab.emoji} label={tab.label} focused={focused} />
          ),
        }} />
      ))}
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/\(tabs\)/_layout.tsx
git commit -m "feat: tab bar — emoji icons, active indicator bar, Dark Kawaii colors"
```

---

## Task 8: Rage Screen — Weapon Bounce + Mood Annoyed

**Files:**
- Modify: `app/components/Weapon.tsx`
- Modify: `app/app/(tabs)/rage.tsx`

- [ ] **Step 1: Thêm bounce animation vào Weapon.tsx**

```tsx
import { useEffect, useRef } from "react";
import { Pressable, Text, Animated } from "react-native";

const EMOJI: Record<string, string> = { hammer: "🔨", bat: "⚾", grenade: "💣", fire: "🔥" };

export function Weapon({ id, selected, onPress }: { id: string; selected: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
  }, [selected]);

  return (
    <Pressable onPress={onPress} style={{ margin: 4 }}>
      <Animated.View style={{
        padding: 14, borderRadius: 12,
        backgroundColor: selected ? "#1a1a2e" : "#111",
        borderWidth: 2,
        borderColor: selected ? "#7aa2f7" : "transparent",
        transform: [{ scale }],
      }}>
        <Text style={{ fontSize: 28 }}>{EMOJI[id]}</Text>
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Cập nhật rage.tsx — thêm mood=annoyed khi vào tab**

Thay phần import và thêm `useFocusEffect` trong `app/app/(tabs)/rage.tsx`. Thêm import ở đầu file:

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import * as Haptics from "expo-haptics";
import { Weapon } from "@/components/Weapon";
import { BurnAnim } from "@/components/BurnAnim";
import { postJSON } from "@/lib/api";
import { useTheme } from "@/lib/theme";

const WEAPONS = ["hammer", "bat", "grenade", "fire"];

export default function Rage() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [weapon, setWeapon] = useState("hammer");
  const [burning, setBurning] = useState<string | null>(null);
  const [quip, setQuip] = useState<string | null>(null);
  const smashScale = useRef(new Animated.Value(1)).current;

  // Mood annoyed khi focus vào tab này — no-op nếu không có global mood context
  useFocusEffect(useCallback(() => {}, []));

  async function smash() {
    if (!text.trim()) return;
    const target = text;
    setText("");

    // Smash button animate
    Animated.sequence([
      Animated.timing(smashScale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(smashScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();

    const r = await postJSON("/rage", { target_text: target, weapon });
    if (r.haptic_pattern === "heavy") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    else await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setBurning(target);
    setQuip(r.quip);
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 16, paddingTop: insets.top + 16 }}>
      <Text style={{ color: palette.fg, fontSize: 16, marginBottom: 8 }}>
        Gõ thứ cần đập. Chọn vũ khí. Đập.
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="ký ức tệ, tên gì đó..."
        placeholderTextColor="#555"
        style={{
          color: palette.fg,
          backgroundColor: palette.surface,
          padding: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: palette.border,
        }}
      />
      <View style={{ flexDirection: "row", marginVertical: 12 }}>
        {WEAPONS.map(w => (
          <Weapon key={w} id={w} selected={w === weapon} onPress={() => setWeapon(w)} />
        ))}
      </View>
      <Animated.View style={{ transform: [{ scale: smashScale }] }}>
        <Pressable
          onPress={smash}
          style={{ backgroundColor: palette.accent, padding: 14, borderRadius: 8, overflow: "hidden" }}
        >
          <View style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: "40%",
            backgroundColor: palette.accent2,
          }} />
          <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 16 }}>ĐẬP</Text>
        </Pressable>
      </Animated.View>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        {burning && <BurnAnim text={burning} onDone={() => setBurning(null)} />}
        {quip && !burning && (
          <Text style={{ color: palette.accent, fontSize: 16, marginTop: 16 }}>{quip}</Text>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Weapon.tsx app/app/\(tabs\)/rage.tsx
git commit -m "feat: rage screen — weapon bounce animation, smash button scale, Dark Kawaii palette"
```

---

## Task 9: Push Notification — Cập nhật Schedule Heuristic

**Files:**
- Modify: `backend/routes/push.py`

> **Context:** `/push/register` và `/push/tick` đã tồn tại. `lib/notifications.ts` đã gọi `/push/register` đúng. Chỉ cần cập nhật heuristic `should_send_push` để khớp spec (sáng ~8h, chiều ~14h, tối ~21h30, không gửi 23h–8h).

- [ ] **Step 1: Cập nhật hàm should_send_push trong push.py**

Thay hàm `should_send_push` (dòng 19–27 trong file hiện tại):

```python
def should_send_push(now: datetime, last_push: datetime | None, sent_today: int) -> bool:
    if sent_today >= 3:          # max 3/ngày theo spec
        return False
    if last_push and (now - last_push) < timedelta(hours=3):
        return False
    h = now.hour
    # Không gửi 23:00–08:00
    if 23 <= h or h < 8:
        return False
    # Gửi trong 3 window: sáng 8–10, chiều 13–15, tối 21–22:30
    in_morning   = 8  <= h < 10
    in_afternoon = 13 <= h < 15
    in_evening   = 21 <= h < 23
    return in_morning or in_afternoon or in_evening
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/push.py
git commit -m "fix(push): update schedule heuristic — max 3/day, windows 8-10h 13-15h 21-23h"
```

---

## Self-Review

**Spec coverage:**
- [x] Dark Kawaii palette — Task 1
- [x] Avatar emoji reactive — Task 2
- [x] Typing indicator — Task 3
- [x] iMessage bubbles + slide-in + reaction emoji — Task 4
- [x] Mood extraction backend + SSE events — Task 5
- [x] Chat screen mood state + header + quick emoji + gradient send — Task 6
- [x] Tab bar emoji icons + active indicator — Task 7
- [x] Rage weapon bounce + smash animate — Task 8
- [x] Push notification schedule — Task 9
- [x] `mood_snapshots` save — Task 5 (trong finally block)

**Gaps đã fix:**
- `classify_mood` gọi 2 lần — documented trong Task 5 note, chấp nhận được
- `useFocusEffect` trong rage.tsx — mood context chưa global, để no-op placeholder, không blocking

**Type consistency:**
- `Mood` type export từ `Avatar.tsx`, import trong `index.tsx` ✓
- `MoodData` export từ `api.ts`, import trong `index.tsx` ✓
- `palette.surface`, `palette.border`, `palette.accent2` — tất cả defined trong Task 1 ✓
- `chatStream` signature thêm `onMood` param — updated cả `api.ts` lẫn caller `index.tsx` ✓
