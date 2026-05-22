# Design: Persona Pivot — Từ "Bảo Vệ Khỏi Ex" Sang "Bạn Thân Tình Yêu"

**Ngày:** 2026-05-22  
**Scope:** Prompt-only (không đụng code)  
**Files thay đổi:** `backend/prompts/persona_base.txt`, `backend/seed.yaml`

---

## Bối Cảnh

Khách phản hồi AI cứ chủ động kéo mọi chủ đề về người yêu cũ. Root cause: persona hiện tại có "nhiệm vụ ngầm" là bảo vệ user khỏi quay lại ex, khiến AI frame mọi cuộc trò chuyện qua lens đó.

Mục tiêu mới: AI là bạn thân nói chuyện tình yêu tổng quát — warm hơn một chút, không có agenda ngầm, không ám ảnh ex.

---

## Thay Đổi

### 1. `backend/prompts/persona_base.txt`

**Cắt:**
- Dòng: `"mục đích NGẦM là bảo vệ user khỏi quay lại với ex"`
- Dòng: `"Mày đang bảo vệ {nickname} khỏi việc quay lại với ex của nó"`
- Rule: `"KHÔNG BAO GIỜ nói tên đầy đủ của ex. Chỉ gọi 'thằng đó', 'nó', 'cái thằng kia'"`

**Sửa — mục đích AI (phần đầu prompt):**
```
Mày là AI bạn thân của {nickname} — đồng hành với cảm xúc của nó về tình yêu,
cuộc sống, crush mới, hay bất cứ thứ gì nó muốn nói. Không có agenda ngầm.
```

**Sửa — tone rule:**
```
Thay: "Châm biếm, khích tướng, nhưng mục đích NGẦM là bảo vệ user khỏi quay lại ex"
→ "Thẳng thắn, thực tế, có thể ấm khi cần — nhưng không sến và không dạy đời"
```

### 2. `backend/seed.yaml`

**Thêm vào `red_lines`:**
```yaml
- Không chủ động lái chủ đề về người cũ trừ khi user tự nhắc trước
```

---

## Những Gì Giữ Nguyên

- Giọng xưng tao/mày, Hà Nội suồng sã
- Slang: "vl", "đm", "ờ", "kiểu", "ghê", v.v.
- Reply ngắn 1–3 câu
- Toàn bộ TOOL USE section
- Style examples
- RAG memories block

---

## Không Trong Scope

- Thay đổi UI, tính năng, tools
- Thay đổi backend logic
- Thay đổi các màn hình khác (rage room, gamification, v.v.)
