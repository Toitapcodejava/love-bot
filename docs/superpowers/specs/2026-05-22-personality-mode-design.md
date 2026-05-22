# Personality Mode — Design Spec

**Ngày:** 2026-05-22
**Tính năng:** Đa dạng tính cách AI agent, user tự chọn mode

---

## 0. Quyết định đã khóa

| Hạng mục | Quyết định |
|---|---|
| Số mode | 2 |
| Approach | Persona file thứ hai + `persona_mode` param trên backend |
| UI chọn mode | Settings tab |
| Persistence | `AsyncStorage` phía app |
| Scope thay đổi khi switch | System prompt + push notification tone + theme mặc định |

---

## 1. Hai Persona Modes

| Key | Tên hiển thị | File prompt | Theme mặc định |
|-----|-------------|-------------|----------------|
| `tsundere` | 😤 Mỏ hỗn | `persona_base.txt` (giữ nguyên) | `chaos` |
| `silent_beauty` | 🌙 Tịnh lặng | `persona_silent_beauty.txt` (mới) | `calm` |

### Voice rules — `silent_beauty`

- Xưng "tao", không gọi "mày" theo kiểu ngang hàng — nhẹ hơn, như người bạn đã trải qua nhiều
- Nói ít, câu ngắn, không chửi thề, không dấu chấm than
- Không khịa, không thách thức — thay bằng quan sát yên tĩnh: *"Mày biết mình cần gì rồi đấy."*
- Vẫn bảo vệ user khỏi ex, bằng sự điềm tĩnh chứ không phải bạo lực ngôn từ
- Push notification vẫn có độ sắc nhưng kiểu khác: *"11h rồi. Mày xứng đáng được ngủ ngon hơn là ngồi nhớ nó."*
- Red lines giữ nguyên (không nhắc tên ex, không toxic positivity)
- Memories vẫn shared giữa hai mode — AI nhớ xuyên suốt bất kể mode

---

## 2. Backend

### `backend/agent.py`

```python
def compile_system_prompt(
    rag_memories: list[str],
    user_status: str | None = None,
    persona_mode: str = "tsundere",
) -> str:
    prompt_file = "persona_base" if persona_mode == "tsundere" else "persona_silent_beauty"
    base = load_prompt(prompt_file)
    # ... phần còn lại giữ nguyên
```

### `backend/prompts/persona_silent_beauty.txt` (file mới)

File prompt độc lập, cùng structure với `persona_base.txt` nhưng toàn bộ voice là "Mỹ nhân tịnh lặng". Có các placeholder giống nhau: `{nickname}`, `{red_lines_compiled}`, `{seed_compiled}`, `{style_md}`, `{rag_memories}`.

### `backend/routes/chat.py`

Đọc `persona_mode` từ request body (default `"tsundere"`), forward xuống `compile_system_prompt()`.

### `backend/routes/push.py`

Đọc `persona_mode` khi generate nội dung push notification, truyền xuống hàm compile prompt. `push.txt` bổ sung instruction phân nhánh tone theo mode.

### Routes không thay đổi

`/vent`, `/rage` — không liên quan đến persona.

---

## 3. Frontend

### `app/lib/storage.ts`

Thêm 2 method:
- `getPersonaMode(): Promise<"tsundere" | "silent_beauty">`
- `setPersonaMode(mode): Promise<void>`

Default: `"tsundere"`.

### `app/app/(tabs)/settings.tsx`

Thêm section **"Bạn của Kem hôm nay là..."** ngay trên phần Theme hiện tại:

```
┌─────────────────────────────────────┐
│  Bạn của Kem hôm nay là...          │
│                                     │
│  ┌──────────────┐ ┌──────────────┐  │
│  │  😤 Mỏ hỗn  │ │ 🌙 Tịnh lặng │  │
│  │  (active)   │ │             │  │
│  └──────────────┘ └──────────────┘  │
└─────────────────────────────────────┘
```

- Bấm card là switch ngay, không cần nút Lưu
- Card active highlight bằng `palette.accent`
- Khi chọn `silent_beauty`: nếu theme hiện tại không phải `calm` thì auto switch sang `calm`
- Khi chọn `tsundere`: nếu đang ở `calm` thì auto switch sang `chaos`
- User vẫn override theme thủ công sau

### `app/app/(tabs)/index.tsx` (ChatScreen)

Đọc `persona_mode` từ storage khi gửi tin nhắn, attach vào request body:

```json
{ "message": "...", "persona_mode": "tsundere" }
```

---

## 4. Các file thay đổi

| File | Loại thay đổi |
|---|---|
| `backend/agent.py` | Edit — thêm param `persona_mode` vào `compile_system_prompt()` |
| `backend/prompts/persona_silent_beauty.txt` | Tạo mới |
| `backend/prompts/push.txt` | Edit — thêm instruction phân nhánh tone |
| `backend/routes/chat.py` | Edit — đọc và forward `persona_mode` |
| `backend/routes/push.py` | Edit — đọc và forward `persona_mode` |
| `app/lib/storage.ts` | Edit — thêm `getPersonaMode` / `setPersonaMode` |
| `app/app/(tabs)/settings.tsx` | Edit — thêm UI chọn mode |
| `app/app/(tabs)/index.tsx` | Edit — attach `persona_mode` vào request |
