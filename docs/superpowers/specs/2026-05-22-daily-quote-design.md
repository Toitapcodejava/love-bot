# Daily Quote Screen — Design Spec

**Ngày:** 2026-05-22
**Tính năng:** Hiển thị quote động viên mỗi lần mở app (chỉ persona silent_beauty)

---

## 0. Quyết định đã khóa

| Hạng mục | Quyết định |
|---|---|
| Trigger | Mỗi lần mở app |
| Persona scope | Chỉ `silent_beauty` — tsundere skip hoàn toàn |
| Dismiss | Tap bất kỳ đâu trên màn hình |
| Nguồn quote | Backend gen batch 5 quotes/ngày bằng AI, cache JSON |
| UI style | Gradient `#1a1040 → #0d0d1f`, emoji 🌙, chữ italic |
| Approach | Modal overlay (giống `CheckInModal`) trong `_layout.tsx` |
| Fail-safe | Timeout 3s → skip modal, không block user |

---

## 1. Architecture & Data Flow

```
App launch
  → load persona_mode từ AsyncStorage
  → nếu silent_beauty:
      → gọi GET /api/quotes/daily (timeout 3s)
      → show QuoteModal
      → user tap → dismiss → vào (tabs)
  → nếu tsundere:
      → vào (tabs) thẳng
```

**Thứ tự modal:** Quote modal hiện trước `CheckInModal`. Nếu cả hai trigger cùng lúc: quote → dismiss → check-in.

---

## 2. Backend

### Endpoint mới

```
GET /api/quotes/daily
Response: { "quote": "..." }
```

### File: `backend/routes/quotes.py`

- Đọc cache từ `backend/data/quotes_cache.json`
- Key cache = ngày hiện tại (`YYYY-MM-DD`)
- Nếu cache có entry cho hôm nay → random 1 trong batch 5, trả về
- Nếu không → gọi Claude với `persona_silent_beauty` voice để gen 5 quotes → lưu cache → trả về 1

### File: `backend/data/quotes_cache.json`

```json
{
  "2026-05-22": [
    "Không cần vội. Mày đang ổn hơn mày nghĩ.",
    "Mày biết mình cần gì rồi đấy.",
    ...
  ]
}
```

### Prompt gen quote

File: `backend/prompts/quote_prompt.txt`

> Viết 5 câu động viên ngắn theo giọng Mỹ nhân tịnh lặng — câu ngắn, không chửi thề, không toxic positivity, không nhắc ex. Mỗi câu một dòng. Chỉ trả về 5 câu, không giải thích.

### Đăng ký route

`backend/main.py` — import và mount `quotes.router`.

---

## 3. App — Component

### File mới: `app/components/QuoteModal.tsx`

Props:
```ts
interface QuoteModalProps {
  visible: boolean;
  quote: string;
  onDismiss: () => void;
}
```

Layout:
- `Modal` (React Native) full-screen, `transparent={false}`, `animationType="fade"`
- `LinearGradient` từ `expo-linear-gradient`: `['#1a1040', '#0d0d1f']`
- Wrap toàn bộ trong `Pressable` — tap bất kỳ đâu gọi `onDismiss`
- Nội dung giữa màn hình:
  - Emoji 🌙 (font size lớn)
  - Quote text — italic, màu `#ddd8f0`, centered
  - Hint "chạm để tiếp tục" — nhỏ, mờ, màu `#7c6fa0`
- Loading state: khi `quote` rỗng, hiện 3 chấm nhấp nháy thay cho text

---

## 4. App — Tích hợp `_layout.tsx`

Thêm vào `AppShell`:

```ts
const [quoteText, setQuoteText] = useState('');
const [showQuote, setShowQuote] = useState(false);
```

Trong `useEffect` sau khi `loaded`:
1. Đọc `persona_mode` từ `AsyncStorage`
2. Nếu `silent_beauty` → fetch `/api/quotes/daily` (timeout 3s) → set `quoteText` + `showQuote = true`
3. Nếu fetch fail hoặc timeout → skip (`showQuote` giữ `false`)

`handleQuoteDone`: set `showQuote = false`. Nếu `isStale(status)` → set `showCheckIn = true` ngay sau đó.

Render thêm:
```tsx
<QuoteModal
  visible={showQuote}
  quote={quoteText}
  onDismiss={handleQuoteDone}
/>
```

---

## 5. Error Handling

| Tình huống | Xử lý |
|---|---|
| Network timeout (>3s) | Skip modal, vào app bình thường |
| Device offline | Skip modal |
| Backend lỗi 500 | Skip modal |
| Claude gen thất bại | Backend trả 500 → app skip |
| Cache file corrupt | Backend regen, không crash |

---

## 6. Files thay đổi

| File | Thay đổi |
|---|---|
| `app/components/QuoteModal.tsx` | Tạo mới |
| `app/app/_layout.tsx` | Thêm quote fetch + QuoteModal |
| `backend/routes/quotes.py` | Tạo mới |
| `backend/data/quotes_cache.json` | Tạo mới (auto-generated) |
| `backend/prompts/quote_prompt.txt` | Tạo mới |
| `backend/main.py` | Mount quotes router |

---

## 7. Testing thủ công

1. Đổi persona → `silent_beauty` → restart app → thấy modal gradient tím
2. Tap bất kỳ → vào tab bình thường
3. Đổi persona → `tsundere` → restart app → không thấy modal
4. Tắt wifi, persona `silent_beauty` → app vẫn vào được (skip modal)
5. Cả quote + check-in cùng trigger → quote hiện trước, check-in sau
