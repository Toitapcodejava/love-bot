# Connected State System Design

**Date:** 2026-05-22  
**Scope:** Rename AI character, user status/icon picker, boss battle rage screen, check-in ritual

---

## Overview

Xây dựng một "connected state system" lấy trạng thái cảm xúc của người dùng (Kem) làm trung tâm, kết nối check-in ritual → status chip → AI context → boss battle thành một luồng nhất quán.

---

## 1. Đổi tên nhân vật

- **AI character**: đổi từ "Kem" (trong header chat) thành **"Bạn của Kem"**
- **Người dùng**: Ngọc Khánh, gọi tắt là **Kem**
- Thay đổi cụ thể:
  - `app/app/(tabs)/index.tsx`: header text "Kem" → "Bạn của Kem"
  - First-run message và greeting message cập nhật để gọi người dùng là "Kem"
  - Backend system prompt cập nhật tên AI và tên user

---

## 2. User Status — Data Model

```ts
type UserStatus = {
  emoji: string;      // "😤"
  label: string;      // "Tức"
  note: string;       // optional free-form note
  timestamp: number;  // ms epoch
};
```

Lưu vào AsyncStorage key `USER_STATUS`. Exposed qua một custom hook `useUserStatus()` trả về `{ status, setStatus, clearStatus }`.

**6 preset statuses:**

| Emoji | Label     | Boss Type     |
|-------|-----------|---------------|
| 😤    | Tức       | Cơn Tức Giận  |
| 😢    | Buồn      | Nỗi Buồn      |
| 😰    | Lo lắng   | Nỗi Lo        |
| 😶    | Trống     | Sự Vô Cảm     |
| 🫠    | Kiệt sức  | Mệt Mỏi       |
| 😌    | Ổn hơn    | (không có boss) |

---

## 3. Check-in Ritual

**Trigger:** Hiện khi mở app nếu `USER_STATUS` không có hoặc `timestamp` > 4 giờ trước.

**UI:** Modal/overlay full screen xuất hiện trước khi vào tab chính.

**Components:**
- `CheckInModal` — modal wrapper, quản lý visible state
- Bên trong: grid 2×3 emoji preset cards (tap để select, highlight khi selected)
- Optional TextInput: "thêm gì không? (không bắt buộc)"
- Button "Vào thôi →" (disabled nếu chưa chọn emoji)

**Flow:**
1. App mở → `_layout.tsx` check timestamp → show `CheckInModal` nếu cần
2. User chọn emoji (bắt buộc) + note (tùy chọn) → nhấn "Vào thôi"
3. Lưu `UserStatus` vào AsyncStorage → dismiss modal → vào app bình thường

---

## 4. Status Chip (Chat Screen)

**Vị trí:** Row nằm giữa ScrollView messages và input bar, padding horizontal 10.

**Chip 1 — Status chip (luôn hiển thị khi có status):**
- Hiển thị: `{emoji} {label} ✎`
- Tap → mở `StatusPickerSheet` (bottom sheet nhỏ, tương tự check-in nhưng compact)

**Chip 2 — "🔥 Đập ngay" (chỉ hiển thị khi status ∈ {tức, buồn, lo lắng, trống, kiệt sức}):**
- Background đỏ nhạt, border đỏ
- Tap → `router.push('/rage')` với boss type được pre-select từ status hiện tại

**AI Context:** `userStatus` được truyền vào system prompt của mỗi request chat stream, dạng:
```
[Trạng thái hiện tại của Kem: 😤 Tức — "{note}"]
```

---

## 5. Boss Battle (Rage Screen)

### Boss Selection

Khi vào Rage screen:
- Nếu có `userStatus` với boss type → auto-select boss đó
- Nếu không → hiện picker để chọn boss thủ công (như weapon picker hiện tại)

### Boss Data

```ts
type Boss = {
  id: string;
  name: string;       // "Cơn Tức Giận"
  emoji: string;      // "😡"
  maxHp: number;      // 1000
  color: string;      // "#ff4444" — màu glow/HP bar
};
```

### Layout

```
[Boss Name] + [HP Bar] + [HP số]
[Weapon selector row — giữ nguyên 4 weapons]
[Boss Touch Zone — chiếm ~50% màn hình]
  → Boss emoji (animated: float idle)
  → Damage number nổi lên khi hit (fade out)
[Combo counter] [Damage total]
```

### Interaction

- **Touch zone:** `Pressable` bao toàn bộ boss area, `onPress` thay vì button "ĐẬP"
- Mỗi touch: tính damage = base damage × weapon multiplier × combo multiplier
- Base damage = 100. Weapon multipliers: hammer 1×, bat 1.2×, fire 1.5×, grenade 1.8×
- Boss shake animation: `Animated.sequence` translate X ±8px × 3 lần, duration 40ms mỗi lần
- Damage number: Animated.Value opacity 0→1→0 + translateY -30px, duration 600ms

### Boss Animations

- **Idle float:** `Animated.loop` → translateY 0 → -8 → 0, duration 1800ms, easing sine
- **Hit shake:** translateX ±8px × 3, 40ms each
- **HP < 30%:** tint overlay đỏ trên boss emoji, float speed tăng 2×, shake amplitude tăng 2×
- **Death:** scale 1 → 1.3 → 0 (duration 400ms) + opacity → 0 → show death screen

### Combo System

- Đánh trong vòng 1000ms kể từ hit trước: combo +1
- Nghỉ > 1500ms: combo reset về 1
- Combo multiplier: x1 (1-2), x1.5 (3-5), x2 (6-9), x3 (10+)

### Death Screen

- Boss emoji explosion (scale out) → death screen
- AI quip từ `/rage` endpoint (giữ nguyên flow hiện tại)
- Hai nút: "Đánh lại" (reset HP, giữ boss) | "Nói chuyện →" (navigate về Chat)

---

## Out of Scope

- XP / leveling system
- Achievement badges
- Check-in history
- Push notification nhắc check-in
- Multiplayer / leaderboard

---

## Files Affected

| File | Thay đổi |
|------|----------|
| `app/app/(tabs)/index.tsx` | Đổi tên header, thêm status chip row, truyền status vào chatStream |
| `app/app/(tabs)/rage.tsx` | Rewrite thành boss battle, bỏ TextInput + button |
| `app/app/_layout.tsx` | Thêm CheckInModal logic |
| `app/lib/userStatus.ts` | New — hook + AsyncStorage logic |
| `app/components/CheckInModal.tsx` | New — check-in overlay |
| `app/components/StatusChip.tsx` | New — status + "đập ngay" chips |
| `app/components/BossArena.tsx` | New — boss touch zone + animations |
| `app/components/Weapon.tsx` | Không đổi |
| `app/components/BurnAnim.tsx` | Không dùng nữa trong rage screen |
| `backend/routes/` | Cập nhật system prompt nhận userStatus |
