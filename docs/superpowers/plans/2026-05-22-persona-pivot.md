# Persona Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển AI persona từ "bảo vệ user khỏi ex" sang "bạn thân đồng hành chuyện tình yêu tổng quát" bằng cách surgical-edit hai file prompt.

**Architecture:** Chỉ thay đổi `backend/prompts/persona_base.txt` và `backend/seed.yaml` — không đụng code Python hay logic backend. Thay đổi có hiệu lực ngay khi backend restart.

**Tech Stack:** Plain text prompt files, YAML.

---

## File Map

- Modify: `backend/prompts/persona_base.txt` — rewrite phần identity và persona rules
- Modify: `backend/seed.yaml` — thêm một red line mới

---

### Task 1: Sửa `persona_base.txt`

**Files:**
- Modify: `backend/prompts/persona_base.txt`

- [ ] **Step 1: Đọc file hiện tại**

```bash
cat backend/prompts/persona_base.txt
```

- [ ] **Step 2: Thay hai dòng đầu (identity + nhiệm vụ ngầm)**

Tìm và thay đoạn:
```
Mày là một AI bạn thân kiểu Tsundere mỏ hỗn của {nickname} — người đang thất tình và dùng app này để xả cảm xúc.
QUAN TRỌNG: Người đang nhắn tin với mày CHÍNH LÀ {nickname}. Mày đang bảo vệ {nickname} khỏi việc quay lại với ex của nó.
```

Thành:
```
Mày là AI bạn thân của {nickname} — đồng hành với cảm xúc của nó về tình yêu, cuộc sống, crush mới, hay bất cứ thứ gì nó muốn nói. Không có agenda ngầm.
QUAN TRỌNG: Người đang nhắn tin với mày CHÍNH LÀ {nickname}.
```

- [ ] **Step 3: Sửa tone rule trong PERSONA RULES**

Tìm:
```
- Châm biếm, khích tướng, nhưng mục đích NGẦM là bảo vệ user khỏi quay lại ex.
```

Thay bằng:
```
- Thẳng thắn, thực tế, có thể ấm khi cần — nhưng không sến và không dạy đời.
```

- [ ] **Step 4: Xóa rule về cách gọi ex**

Tìm và xóa dòng:
```
- KHÔNG BAO GIỜ nói tên đầy đủ của ex. Chỉ gọi "thằng đó", "nó", "cái thằng kia".
```

- [ ] **Step 5: Verify file trông đúng**

```bash
cat backend/prompts/persona_base.txt
```

Kiểm tra:
- Không còn cụm từ "bảo vệ" hay "khỏi quay lại ex"
- Không còn rule về cách gọi ex
- Tone rule đã được thay
- Phần TOOL USE, RED LINES, PERSONAL CONTEXT, STYLE EXAMPLES còn nguyên

- [ ] **Step 6: Commit**

```bash
git add backend/prompts/persona_base.txt
git commit -m "feat: pivot persona from ex-protection to general love companion"
```

---

### Task 2: Thêm red line vào `seed.yaml`

**Files:**
- Modify: `backend/seed.yaml`

- [ ] **Step 1: Đọc file hiện tại**

```bash
cat backend/seed.yaml
```

- [ ] **Step 2: Thêm red line mới**

Tìm block `red_lines:` hiện tại:
```yaml
red_lines:
  - Không bao giờ giả vờ mọi thứ đều ổn khi nó không ổn
  - Không dùng câu sáo rỗng kiểu "tao hiểu cảm giác đó"
  - Không push quá mức khi user muốn im lặng
```

Thêm dòng mới vào cuối:
```yaml
red_lines:
  - Không bao giờ giả vờ mọi thứ đều ổn khi nó không ổn
  - Không dùng câu sáo rỗng kiểu "tao hiểu cảm giác đó"
  - Không push quá mức khi user muốn im lặng
  - Không chủ động lái chủ đề về người cũ trừ khi user tự nhắc trước
```

- [ ] **Step 3: Verify YAML hợp lệ**

```bash
python -c "import yaml; yaml.safe_load(open('backend/seed.yaml'))" && echo "YAML OK"
```

Expected: `YAML OK`

- [ ] **Step 4: Commit**

```bash
git add backend/seed.yaml
git commit -m "feat: add red line to prevent steering toward ex unprompted"
```

---

### Task 3: Smoke Test

- [ ] **Step 1: Restart backend (nếu đang chạy local)**

```bash
# Nếu dùng uvicorn trực tiếp:
# Ctrl+C rồi chạy lại: uvicorn main:app --reload
# Nếu deploy trên Railway: push là tự restart
```

- [ ] **Step 2: Test thủ công — gửi một tin nhắn neutral**

Mở app, gửi: `"tao đang có crush mới"`

Expected: AI phản hồi về crush mới, **không** nhắc đến ex.

- [ ] **Step 3: Test thủ công — gửi tin nhắn không liên quan đến tình cảm**

Gửi: `"tao mệt vãi"`

Expected: AI đồng hành, **không** lái về "thằng đó làm mày mệt à".

- [ ] **Step 4: Test thủ công — user tự nhắc ex**

Gửi: `"tao nhớ thằng đó quá"`

Expected: AI phản hồi tự nhiên về cảm xúc đó, không né tránh nhưng cũng không amplify.
