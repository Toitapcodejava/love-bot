# Connected State System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng connected state system lấy trạng thái cảm xúc của Kem làm trung tâm: check-in ritual → status chip → AI context → boss battle.

**Architecture:** `useUserStatus` hook (AsyncStorage) là single source of truth cho toàn app. `_layout.tsx` trigger check-in khi cần. Chat screen hiển thị status chip + quick action. Rage screen rewrite thành boss battle dùng touch thay vì button.

**Tech Stack:** React Native (Animated API), Expo Router, AsyncStorage, FastAPI (backend system prompt update)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/lib/userStatus.ts` | Create | UserStatus type, PRESETS constant, useUserStatus hook, AsyncStorage r/w |
| `app/lib/api.ts` | Modify | chatStream nhận thêm `statusContext?: string` param |
| `app/components/CheckInModal.tsx` | Create | Full-screen check-in overlay, emoji grid 2×3, note input, confirm button |
| `app/components/StatusChip.tsx` | Create | Status pill + "Đập ngay" chip, mini picker sheet |
| `app/components/BossArena.tsx` | Create | Boss touch zone, idle float anim, hit shake, damage number, HP logic |
| `app/app/_layout.tsx` | Modify | Wrap RootLayoutNav với UserStatusProvider + CheckInModal trigger |
| `app/app/(tabs)/index.tsx` | Modify | Đổi tên header → "Bạn của Kem", thêm StatusChip row, truyền status vào chatStream |
| `app/app/(tabs)/rage.tsx` | Rewrite | Boss battle layout dùng BossArena, bỏ TextInput+button cũ |
| `backend/routes/chat.py` | Modify | ChatIn nhận thêm `user_status`, truyền vào respond_stream |
| `backend/agent.py` | Modify | compile_system_prompt nhận `user_status` param, inject vào system prompt |
| `backend/routes/rage.py` | Modify | RageIn nhận `boss_id`, quip map theo boss |

---

## Task 1: userStatus lib — data model + hook

**Files:**
- Create: `app/lib/userStatus.ts`

- [ ] **Step 1: Tạo file với type, presets và hook**

```typescript
// app/lib/userStatus.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useCallback } from "react";

export type UserStatus = {
  emoji: string;
  label: string;
  note: string;
  timestamp: number;
};

export type Preset = UserStatus & { bossId: string | null };

export const PRESETS: Preset[] = [
  { emoji: "😤", label: "Tức",      note: "", timestamp: 0, bossId: "anger"     },
  { emoji: "😢", label: "Buồn",     note: "", timestamp: 0, bossId: "sadness"   },
  { emoji: "😰", label: "Lo lắng",  note: "", timestamp: 0, bossId: "anxiety"   },
  { emoji: "😶", label: "Trống",    note: "", timestamp: 0, bossId: "numbness"  },
  { emoji: "🫠", label: "Kiệt sức", note: "", timestamp: 0, bossId: "exhaustion"},
  { emoji: "😌", label: "Ổn hơn",   note: "", timestamp: 0, bossId: null        },
];

const KEY = "USER_STATUS";
const STALE_MS = 4 * 60 * 60 * 1000; // 4 hours

export function isStale(status: UserStatus | null): boolean {
  if (!status) return true;
  return Date.now() - status.timestamp > STALE_MS;
}

export function useUserStatus() {
  const [status, setStatusState] = useState<UserStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) setStatusState(JSON.parse(raw));
      setLoaded(true);
    });
  }, []);

  const setStatus = useCallback(async (s: UserStatus) => {
    const next = { ...s, timestamp: Date.now() };
    setStatusState(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const clearStatus = useCallback(async () => {
    setStatusState(null);
    await AsyncStorage.removeItem(KEY);
  }, []);

  return { status, setStatus, clearStatus, loaded };
}

export function statusContext(status: UserStatus | null): string | undefined {
  if (!status) return undefined;
  const note = status.note ? ` — "${status.note}"` : "";
  return `[Trạng thái hiện tại của Kem: ${status.emoji} ${status.label}${note}]`;
}
```

- [ ] **Step 2: Kiểm tra AsyncStorage đã được install**

```bash
cd app && npx expo install @react-native-async-storage/async-storage
```

Expected: package.json thêm `@react-native-async-storage/async-storage`

- [ ] **Step 3: Commit**

```bash
git add app/lib/userStatus.ts app/package.json
git commit -m "feat: add userStatus lib — type, presets, hook, AsyncStorage"
```

---

## Task 2: CheckInModal component

**Files:**
- Create: `app/components/CheckInModal.tsx`

- [ ] **Step 1: Tạo CheckInModal**

```typescript
// app/components/CheckInModal.tsx
import { useState } from "react";
import {
  Modal, View, Text, Pressable, TextInput,
  StyleSheet, Platform, KeyboardAvoidingView,
} from "react-native";
import { PRESETS, UserStatus } from "@/lib/userStatus";
import { useTheme } from "@/lib/theme";

interface Props {
  visible: boolean;
  onDone: (status: UserStatus) => void;
}

export function CheckInModal({ visible, onDone }: Props) {
  const { palette } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");

  function confirm() {
    if (selected === null) return;
    const preset = PRESETS[selected];
    onDone({ emoji: preset.emoji, label: preset.label, note: note.trim(), timestamp: Date.now() });
    setSelected(null);
    setNote("");
  }

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.aiLabel, { color: palette.accent }]}>Bạn của Kem</Text>
        <Text style={[styles.question, { color: palette.fg }]}>"Kem đang thế nào?"</Text>

        <View style={styles.grid}>
          {PRESETS.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => setSelected(i)}
              style={[
                styles.card,
                { backgroundColor: palette.surface, borderColor: palette.border },
                selected === i && { borderColor: palette.accent, backgroundColor: palette.surface },
              ]}
            >
              <Text style={styles.cardEmoji}>{p.emoji}</Text>
              <Text style={[styles.cardLabel, { color: palette.fg }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="thêm gì không? (không bắt buộc)"
          placeholderTextColor="#555"
          style={[styles.noteInput, { color: palette.fg, backgroundColor: palette.surface, borderColor: palette.border }]}
        />

        <Pressable
          onPress={confirm}
          disabled={selected === null}
          style={[
            styles.button,
            { backgroundColor: selected === null ? "#333" : palette.accent },
          ]}
        >
          <Text style={styles.buttonText}>Vào thôi →</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  aiLabel:     { fontSize: 12, marginBottom: 4, letterSpacing: 0.5 },
  question:    { fontSize: 20, fontWeight: "700", marginBottom: 24, textAlign: "center" },
  grid:        { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 20 },
  card:        { width: 90, alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1.5 },
  cardEmoji:   { fontSize: 28, marginBottom: 4 },
  cardLabel:   { fontSize: 11 },
  noteInput:   { width: "100%", borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13 },
  button:      { width: "100%", padding: 14, borderRadius: 8, alignItems: "center" },
  buttonText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/components/CheckInModal.tsx
git commit -m "feat: CheckInModal — emoji grid 2x3, note input, confirm"
```

---

## Task 3: Wire CheckInModal vào _layout.tsx

**Files:**
- Modify: `app/app/_layout.tsx`

- [ ] **Step 1: Cập nhật _layout.tsx**

Thay toàn bộ nội dung file:

```typescript
// app/app/_layout.tsx
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { ThemeProvider, useTheme } from "@/lib/theme";
import { bindThemeSetter } from "@/lib/toolExecutor";
import { registerForPush } from "@/lib/notifications";
import { useUserStatus, isStale, UserStatus } from "@/lib/userStatus";
import { CheckInModal } from "@/components/CheckInModal";

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

  useEffect(() => {
    if (loaded && isStale(status)) {
      setShowCheckIn(true);
    }
  }, [loaded, status]);

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

- [ ] **Step 2: Test thủ công**

Chạy app (`npx expo start`), lần đầu mở app phải thấy CheckInModal hiện ra. Chọn emoji → "Vào thôi" → modal dismiss, vào app bình thường. Mở lại app trong vòng 4h → không thấy modal.

- [ ] **Step 3: Commit**

```bash
git add app/app/_layout.tsx
git commit -m "feat: trigger CheckInModal on app open when status stale"
```

---

## Task 4: StatusChip component

**Files:**
- Create: `app/components/StatusChip.tsx`

- [ ] **Step 1: Tạo StatusChip**

```typescript
// app/components/StatusChip.tsx
import { useState } from "react";
import {
  View, Text, Pressable, Modal, StyleSheet,
  KeyboardAvoidingView, Platform, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { PRESETS, UserStatus, useUserStatus } from "@/lib/userStatus";
import { useTheme } from "@/lib/theme";

const NEGATIVE_LABELS = new Set(["Tức", "Buồn", "Lo lắng", "Trống", "Kiệt sức"]);

interface Props {
  status: UserStatus;
  onUpdate: (s: UserStatus) => void;
}

export function StatusChip({ status, onUpdate }: Props) {
  const { palette } = useTheme();
  const router = useRouter();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const isNegative = NEGATIVE_LABELS.has(status.label);

  function openPicker() {
    const idx = PRESETS.findIndex((p) => p.label === status.label);
    setSelected(idx >= 0 ? idx : null);
    setNote(status.note ?? "");
    setPickerVisible(true);
  }

  function confirmPicker() {
    if (selected === null) return;
    const p = PRESETS[selected];
    onUpdate({ emoji: p.emoji, label: p.label, note: note.trim(), timestamp: Date.now() });
    setPickerVisible(false);
  }

  return (
    <>
      <View style={styles.row}>
        {/* Status chip */}
        <Pressable
          onPress={openPicker}
          style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={styles.emoji}>{status.emoji}</Text>
          <Text style={[styles.label, { color: palette.fg }]}>{status.label}</Text>
          <Text style={[styles.edit, { color: "#555" }]}>✎</Text>
        </Pressable>

        {/* Đập ngay chip — only when negative */}
        {isNegative && (
          <Pressable
            onPress={() => router.push("/rage")}
            style={styles.rageChip}
          >
            <Text style={styles.rageText}>🔥 Đập ngay</Text>
          </Pressable>
        )}
      </View>

      {/* Mini picker modal */}
      <Modal visible={pickerVisible} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.sheet, { backgroundColor: palette.surface }]}
        >
          <View style={styles.grid}>
            {PRESETS.map((p, i) => (
              <Pressable
                key={p.label}
                onPress={() => setSelected(i)}
                style={[
                  styles.card,
                  { borderColor: palette.border, backgroundColor: palette.bg },
                  selected === i && { borderColor: palette.accent },
                ]}
              >
                <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
                <Text style={[styles.cardLabel, { color: palette.fg }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="thêm gì không?"
            placeholderTextColor="#555"
            style={[styles.noteInput, { color: palette.fg, borderColor: palette.border }]}
          />
          <Pressable
            onPress={confirmPicker}
            disabled={selected === null}
            style={[styles.confirmBtn, { backgroundColor: selected === null ? "#333" : palette.accent }]}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Xong</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 4 },
  chip:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  emoji:      { fontSize: 14 },
  label:      { fontSize: 11 },
  edit:       { fontSize: 11 },
  rageChip:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "#ff4444", backgroundColor: "#2a1a1a" },
  rageText:   { color: "#ff6666", fontSize: 11 },
  backdrop:   { flex: 1 },
  sheet:      { padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  grid:       { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 12 },
  card:       { width: 80, alignItems: "center", padding: 8, borderRadius: 10, borderWidth: 1.5 },
  cardLabel:  { fontSize: 10, marginTop: 2 },
  noteInput:  { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 12, marginBottom: 10 },
  confirmBtn: { padding: 12, borderRadius: 8, alignItems: "center" },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/components/StatusChip.tsx
git commit -m "feat: StatusChip — status pill + Đập ngay chip + mini picker sheet"
```

---

## Task 5: Cập nhật Chat screen (index.tsx)

**Files:**
- Modify: `app/app/(tabs)/index.tsx`
- Modify: `app/lib/api.ts`

- [ ] **Step 1: Thêm `statusContext` param vào chatStream trong api.ts**

Thay signature và body của `chatStream`:

```typescript
// app/lib/api.ts — thay hàm chatStream
export async function chatStream(
  message: string,
  onText: (t: string) => void,
  onTools: (t: ToolCall[]) => void,
  onMood: (m: MoodData) => void,
  onDone: () => void,
  onError: (e: any) => void,
  statusContext?: string,
) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const es = new EventSource(`${base}/chat`, {
    method: "POST",
    headers: { "x-app-key": key, "content-type": "application/json" },
    body: JSON.stringify({ message, user_status: statusContext }),
    pollingInterval: 0,
  });
  es.addEventListener("text", (e: any) => onText(e.data));
  es.addEventListener("tool", (e: any) => onTools(JSON.parse(e.data)));
  es.addEventListener("mood", (e: any) => onMood(JSON.parse(e.data)));
  es.addEventListener("done", () => { es.close(); onDone(); });
  es.addEventListener("error", (e: any) => { es.close(); onError(e); });
  return () => es.close();
}
```

- [ ] **Step 2: Cập nhật index.tsx**

Thay toàn bộ nội dung file:

```typescript
// app/app/(tabs)/index.tsx
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
import { StatusChip } from "@/components/StatusChip";
import { useUserStatus, statusContext, UserStatus } from "@/lib/userStatus";
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
  const { status, setStatus } = useUserStatus();
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
        setMsgs([{ role: "assistant", content: "Ờ. Thằng dev nó làm cái này cho mày. Đừng cảm động vội — tao là loại khó tính. Bắt đầu kể đi, Kem." }]);
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
      statusContext(status),
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
          <Text style={{ color: palette.fg, fontSize: 15, fontWeight: "700" }}>Bạn của Kem</Text>
          {streaming
            ? <TypingIndicator showLabel={true} />
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

      {/* Status chip row — only when status exists */}
      {status && (
        <StatusChip
          status={status}
          onUpdate={(s: UserStatus) => setStatus(s)}
        />
      )}

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
git add app/lib/api.ts app/app/(tabs)/index.tsx
git commit -m "feat: chat screen — rename to Bạn của Kem, add StatusChip row, pass status to AI"
```

---

## Task 6: BossArena component

**Files:**
- Create: `app/components/BossArena.tsx`

- [ ] **Step 1: Tạo BossArena**

```typescript
// app/components/BossArena.tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated, Easing, StyleSheet } from "react-native";

export type Boss = {
  id: string;
  name: string;
  emoji: string;
  maxHp: number;
  color: string;
};

export const BOSSES: Boss[] = [
  { id: "anger",     name: "Cơn Tức Giận", emoji: "😡", maxHp: 1000, color: "#ff4444" },
  { id: "sadness",   name: "Nỗi Buồn",     emoji: "😭", maxHp: 800,  color: "#7aa2f7" },
  { id: "anxiety",   name: "Nỗi Lo",       emoji: "😰", maxHp: 900,  color: "#bb9af7" },
  { id: "numbness",  name: "Sự Vô Cảm",    emoji: "😶", maxHp: 700,  color: "#888888" },
  { id: "exhaustion",name: "Mệt Mỏi",      emoji: "🫠", maxHp: 750,  color: "#f7c948" },
];

interface Props {
  boss: Boss;
  weapon: string;
  onDeath: (quip: string) => void;
  onHit: (damage: number) => void;
}

const WEAPON_MULTIPLIER: Record<string, number> = {
  hammer: 1.0,
  bat: 1.2,
  fire: 1.5,
  grenade: 1.8,
};

function comboMultiplier(combo: number): number {
  if (combo >= 10) return 3;
  if (combo >= 6)  return 2;
  if (combo >= 3)  return 1.5;
  return 1;
}

type DamageFloat = { id: number; value: number; anim: Animated.Value; y: Animated.Value };

export function BossArena({ boss, weapon, onDeath, onHit }: Props) {
  const [hp, setHp] = useState(boss.maxHp);
  const [combo, setCombo] = useState(1);
  const [totalDamage, setTotalDamage] = useState(0);
  const [floats, setFloats] = useState<DamageFloat[]>([]);
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHit = useRef(0);
  const floatId = useRef(0);

  // Idle float animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  // Hit shake
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Death scale
  const deathScale = useRef(new Animated.Value(1)).current;
  const deathOpacity = useRef(new Animated.Value(1)).current;

  const hpPercent = hp / boss.maxHp;
  const isLow = hpPercent < 0.3;
  const isDead = hp <= 0;

  // Start idle float loop
  useEffect(() => {
    const duration = isLow ? 900 : 1800;
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,  duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    return () => floatAnim.stopAnimation();
  }, [isLow]);

  function shake(amplitude: number) {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  amplitude, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -amplitude, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  amplitude, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,          duration: 40, useNativeDriver: true }),
    ]).start();
  }

  function spawnFloat(damage: number) {
    const id = ++floatId.current;
    const anim = new Animated.Value(1);
    const y = new Animated.Value(0);
    setFloats(prev => [...prev, { id, value: damage, anim, y }]);
    Animated.parallel([
      Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(y,    { toValue: -30, duration: 600, useNativeDriver: true }),
    ]).start(() => setFloats(prev => prev.filter(f => f.id !== id)));
  }

  function handleHit() {
    if (hp <= 0) return;
    const now = Date.now();
    let newCombo = combo;

    if (now - lastHit.current <= 1000) {
      newCombo = combo + 1;
    } else {
      newCombo = 1;
    }
    lastHit.current = now;
    setCombo(newCombo);

    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => setCombo(1), 1500);

    const damage = Math.round(100 * (WEAPON_MULTIPLIER[weapon] ?? 1) * comboMultiplier(newCombo));
    const shakeAmp = isLow ? 16 : 8;
    shake(shakeAmp);
    spawnFloat(damage);
    onHit(damage);

    setTotalDamage(prev => prev + damage);
    setHp(prev => {
      const next = Math.max(0, prev - damage);
      if (next <= 0) {
        // Death animation
        Animated.sequence([
          Animated.timing(deathScale,   { toValue: 1.3, duration: 200, useNativeDriver: true }),
          Animated.parallel([
            Animated.timing(deathScale,   { toValue: 0,   duration: 200, useNativeDriver: true }),
            Animated.timing(deathOpacity, { toValue: 0,   duration: 200, useNativeDriver: true }),
          ]),
        ]).start(() => onDeath(""));
      }
      return next;
    });
  }

  return (
    <View style={styles.container}>
      {/* Boss name + HP */}
      <View style={styles.hpRow}>
        <Text style={[styles.bossName, { color: boss.color }]}>{boss.name}</Text>
        <View style={[styles.hpBarBg]}>
          <View style={[styles.hpBarFill, { width: `${hpPercent * 100}%` as any, backgroundColor: boss.color }]} />
        </View>
        <Text style={styles.hpText}>{hp} / {boss.maxHp} HP</Text>
      </View>

      {/* Boss touch zone */}
      <Pressable onPress={handleHit} style={styles.touchZone}>
        <Text style={styles.tapHint}>TAP ĐỂ ĐÁNH</Text>

        <Animated.View style={{
          transform: [
            { translateY: floatAnim },
            { translateX: shakeAnim },
            { scale: deathScale },
          ],
          opacity: deathOpacity,
        }}>
          <Text style={[styles.bossEmoji, isLow && { tintColor: "#ff0000" }]}>{boss.emoji}</Text>
          {isLow && (
            <View style={[StyleSheet.absoluteFillObject, styles.lowHpOverlay]} pointerEvents="none" />
          )}
        </Animated.View>

        {/* Damage floats */}
        {floats.map(f => (
          <Animated.Text
            key={f.id}
            style={[styles.damageFloat, { opacity: f.anim, transform: [{ translateY: f.y }] }]}
          >
            -{f.value}
          </Animated.Text>
        ))}

        {isLow && (
          <Text style={styles.lowHpLabel}>đang đau... sắp xong rồi</Text>
        )}
      </Pressable>

      {/* Combo + damage total */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>COMBO</Text>
          <Text style={styles.statValue}>x{combo}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: "#bb9af7" }]}>DAMAGE</Text>
          <Text style={styles.statValue}>{totalDamage}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  hpRow:        { marginBottom: 12 },
  bossName:     { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  hpBarBg:      { height: 8, backgroundColor: "#1a1a1a", borderRadius: 4, overflow: "hidden", marginBottom: 2 },
  hpBarFill:    { height: "100%", borderRadius: 4 },
  hpText:       { color: "#888", fontSize: 10 },
  touchZone:    { flex: 1, alignItems: "center", justifyContent: "center", position: "relative",
                  backgroundColor: "#0d0d1a", borderRadius: 16, borderWidth: 2, borderColor: "#1a1a2e",
                  borderStyle: "dashed", marginBottom: 12 },
  tapHint:      { position: "absolute", top: 10, color: "#555", fontSize: 10, letterSpacing: 1 },
  bossEmoji:    { fontSize: 80, textAlign: "center" },
  lowHpOverlay: { backgroundColor: "rgba(255,0,0,0.15)", borderRadius: 16 },
  lowHpLabel:   { position: "absolute", bottom: 12, color: "#ff8800", fontSize: 10 },
  damageFloat:  { position: "absolute", color: "#ff4444", fontSize: 22, fontWeight: "900" },
  statsRow:     { flexDirection: "row", justifyContent: "space-between" },
  statBox:      { backgroundColor: "#1a1a2e", borderRadius: 8, padding: 10, flex: 1, marginHorizontal: 4, alignItems: "center" },
  statLabel:    { color: "#7aa2f7", fontSize: 10 },
  statValue:    { color: "#fff", fontSize: 20, fontWeight: "900" },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/components/BossArena.tsx
git commit -m "feat: BossArena — touch-to-hit, idle float, shake, damage floats, combo, death anim"
```

---

## Task 7: Rewrite Rage screen

**Files:**
- Modify: `app/app/(tabs)/rage.tsx`

- [ ] **Step 1: Rewrite rage.tsx**

```typescript
// app/app/(tabs)/rage.tsx
import { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Weapon } from "@/components/Weapon";
import { BossArena, BOSSES, Boss } from "@/components/BossArena";
import { postJSON } from "@/lib/api";
import { useUserStatus, PRESETS } from "@/lib/userStatus";
import { useTheme } from "@/lib/theme";

function bossFromStatus(statusLabel: string | undefined): Boss | null {
  if (!statusLabel) return null;
  const preset = PRESETS.find(p => p.label === statusLabel);
  if (!preset?.bossId) return null;
  return BOSSES.find(b => b.id === preset.bossId) ?? null;
}

const WEAPONS = ["hammer", "bat", "grenade", "fire"];

export default function Rage() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { status } = useUserStatus();

  const autoBoss = bossFromStatus(status?.label);
  const [boss, setBoss] = useState<Boss | null>(autoBoss);
  const [weapon, setWeapon] = useState("hammer");
  const [quip, setQuip] = useState<string | null>(null);
  const [dead, setDead] = useState(false);
  const [arenaKey, setArenaKey] = useState(0); // force remount to reset

  // Sync boss when status changes (e.g. user came from Đập ngay chip)
  useFocusEffect(useCallback(() => {
    const b = bossFromStatus(status?.label);
    if (b && !dead) {
      setBoss(b);
      setArenaKey(k => k + 1);
      setDead(false);
      setQuip(null);
    }
  }, [status?.label]));

  async function handleDeath(_: string) {
    setDead(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const r = await postJSON("/rage", { boss_id: boss?.id ?? "anger", weapon });
      setQuip(r.quip);
    } catch {
      setQuip("Xong rồi. Khỏe chưa?");
    }
  }

  async function handleHit(_: number) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function resetBoss() {
    setDead(false);
    setQuip(null);
    setArenaKey(k => k + 1);
  }

  // No boss selected — show boss picker
  if (!boss) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, padding: 16, paddingTop: insets.top + 16 }}>
        <Text style={{ color: palette.fg, fontSize: 16, fontWeight: "700", marginBottom: 16 }}>Chọn kẻ thù</Text>
        {BOSSES.map(b => (
          <Pressable
            key={b.id}
            onPress={() => { setBoss(b); setArenaKey(k => k + 1); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
              backgroundColor: palette.surface, borderRadius: 10, marginBottom: 10,
              borderWidth: 1, borderColor: palette.border }}
          >
            <Text style={{ fontSize: 28 }}>{b.emoji}</Text>
            <Text style={{ color: palette.fg, fontSize: 14, fontWeight: "600" }}>{b.name}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  // Death screen
  if (dead) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 64, marginBottom: 12 }}>💀</Text>
        <Text style={{ color: "#ff4444", fontSize: 20, fontWeight: "900", marginBottom: 4 }}>ĐÃ TIÊU DIỆT!</Text>
        <Text style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>{boss.name} đã bị dập tắt</Text>
        {quip && (
          <View style={{ backgroundColor: palette.surface, borderRadius: 12, padding: 14, marginBottom: 24, maxWidth: 280 }}>
            <Text style={{ color: palette.accent, fontSize: 10, marginBottom: 4 }}>Bạn của Kem nói:</Text>
            <Text style={{ color: palette.fg, fontSize: 13, fontStyle: "italic" }}>"{quip}"</Text>
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable onPress={resetBoss}
            style={{ backgroundColor: palette.surface, borderRadius: 8, padding: 12, paddingHorizontal: 20 }}>
            <Text style={{ color: palette.fg }}>Đánh lại</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/")}
            style={{ backgroundColor: palette.accent, borderRadius: 8, padding: 12, paddingHorizontal: 20 }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Nói chuyện →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Battle screen
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 16, paddingTop: insets.top + 16 }}>
      {/* Weapon selector */}
      <View style={{ flexDirection: "row", marginBottom: 12 }}>
        {WEAPONS.map(w => (
          <Weapon key={w} id={w} selected={w === weapon} onPress={() => setWeapon(w)} />
        ))}
      </View>

      {/* Boss arena — takes up remaining space */}
      <BossArena
        key={arenaKey}
        boss={boss}
        weapon={weapon}
        onDeath={handleDeath}
        onHit={handleHit}
      />
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/(tabs)/rage.tsx
git commit -m "feat: rage screen rewrite — boss battle, touch-to-hit, death screen, back to chat"
```

---

## Task 8: Backend — nhận user_status trong /chat

**Files:**
- Modify: `backend/routes/chat.py`
- Modify: `backend/agent.py`

- [ ] **Step 1: Cập nhật ChatIn model và truyền user_status**

Trong `backend/routes/chat.py`, thay `ChatIn` và call `respond_stream`:

```python
class ChatIn(BaseModel):
    message: str
    user_status: str | None = None
```

Và trong hàm `chat`, thay dòng `async for chunk in respond_stream(history, rag):` thành:

```python
async for chunk in respond_stream(history, rag, payload.user_status):
```

- [ ] **Step 2: Cập nhật agent.py — inject status vào system prompt**

Trong `backend/agent.py`, thay signature `respond_stream` và `compile_system_prompt`:

```python
def compile_system_prompt(rag_memories: list[str], user_status: str | None = None) -> str:
    seed = load_seed()
    style = load_style()
    base = load_prompt("persona_base")
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


async def respond_stream(messages: list[dict], rag_memories: list[str], user_status: str | None = None):
    system = compile_system_prompt(rag_memories, user_status)
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

- [ ] **Step 3: Commit**

```bash
git add backend/routes/chat.py backend/agent.py
git commit -m "feat: backend /chat nhận user_status, inject vào system prompt"
```

---

## Task 9: Backend — cập nhật /rage endpoint

**Files:**
- Modify: `backend/routes/rage.py`

- [ ] **Step 1: Cập nhật RageIn và quip map theo boss**

Thay toàn bộ nội dung file:

```python
import random
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from db import get_pool

router = APIRouter()

HAPTIC = {"hammer": "heavy", "bat": "double", "grenade": "long", "fire": "long"}

QUIPS = {
    "anger":      ["Đập xong chưa. Giờ kể tao nghe chuyện gì xảy ra đi.", "Tức thì đập. Nhưng gốc rễ vẫn còn đó — kể không?", "Cơn tức vừa thua mày rồi."],
    "sadness":    ["Nỗi buồn không mất đâu. Nhưng giờ mày mạnh hơn nó một chút.", "Đánh xong rồi. Khóc được thì cứ khóc, tao ở đây.", "Buồn thì buồn. Nhưng mày không một mình."],
    "anxiety":    ["Nỗi lo vừa thua. Thở đi. Kể tao nghe lo cái gì.", "Đánh nó rồi. Lo thật sự về cái gì vậy?", "Anxiety thua rồi. Nhưng tao cần biết mày đang lo gì."],
    "numbness":   ["Trống thì đánh. Cảm giác gì chưa?", "Sự vô cảm vừa bị mày đập. Còn cảm thấy gì không?", "Đánh xong rồi. Mày ổn không?"],
    "exhaustion": ["Mệt thì nghỉ sau khi đánh xong. Kể tao nghe mày kiệt vì cái gì.", "Mệt Mỏi vừa thua. Nhưng mày cần nghỉ ngơi thật sự — kể tao nghe."],
}

DEFAULT_QUIPS = ["Đập xong. Khỏe chưa?", "Xong rồi. Kể tao nghe.", "Tiêu diệt. Giờ nói chuyện đi."]


class RageIn(BaseModel):
    boss_id: str
    weapon: str


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
    boss_quips = QUIPS.get(payload.boss_id, DEFAULT_QUIPS)
    return {
        "haptic_pattern": HAPTIC.get(payload.weapon, "heavy"),
        "particle_seed": random.randint(0, 2**31),
        "quip": random.choice(boss_quips),
    }
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/rage.py
git commit -m "feat: /rage endpoint nhận boss_id, quip map theo boss type"
```

---

## Task 10: Smoke test toàn bộ flow

- [ ] **Step 1: Chạy app**

```bash
cd app && npx expo start
```

- [ ] **Step 2: Test check-in flow**

1. Clear AsyncStorage (hoặc uninstall/reinstall app) → mở app → CheckInModal xuất hiện
2. Chọn emoji "😤 Tức" → nhấn "Vào thôi" → modal dismiss, vào chat
3. Chat screen header hiển thị **"Bạn của Kem"**
4. Status chip hiện `😤 Tức ✎` và chip `🔥 Đập ngay`
5. Mở lại app trong 4h → modal KHÔNG hiện lại

- [ ] **Step 3: Test status chip**

1. Tap `😤 Tức ✎` → mini picker sheet hiện
2. Chọn emoji khác → "Xong" → chip cập nhật
3. Chọn `😌 Ổn hơn` → chip `🔥 Đập ngay` biến mất

- [ ] **Step 4: Test boss battle**

1. Tap `🔥 Đập ngay` → vào Rage screen
2. Boss "Cơn Tức Giận" được auto-select (khớp với status "Tức")
3. Touch vào boss area → boss shake, damage number nổi lên
4. Đánh liên tục → combo tăng, multiplier tăng
5. HP về 0 → death animation → death screen với quip
6. Nhấn "Nói chuyện →" → về chat screen

- [ ] **Step 5: Test không có status**

1. Vào Rage tab trực tiếp khi không có status → boss picker hiện
2. Chọn boss → battle bình thường

- [ ] **Step 6: Commit nếu có fix nhỏ**

```bash
git add -p
git commit -m "fix: smoke test fixes"
```
