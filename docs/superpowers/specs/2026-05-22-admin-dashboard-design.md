# Admin Dashboard & GPS Location Feature — Design Spec
**Date:** 2026-05-22

---

## Overview

Bổ sung hai tính năng vào project love-bot:

1. **Admin Dashboard** — web UI tại `/admin`, chỉ dev dùng, để push noti thủ công, xem GPS, chat log, và status log của Kem.
2. **GPS + Location Suggestions** — Expo app tracking vị trí của Kem (opt-in), backend lưu history, AI "Bạn của Kem" dùng vị trí + mood để gợi ý hoạt động/địa điểm gần đó qua Overpass API.

**Nhân vật:**
- **Kem** = người dùng thực tế của app
- **Bạn của Kem** = nhân vật AI trong app
- **Dev** = người dùng admin dashboard

---

## Architecture

```
[Expo App — additions]
  ├─ Settings toggle: "Cho Bạn của Kem biết vị trí của bạn"
  ├─ expo-location background task → POST /location/update (mỗi 15 phút)
  ├─ GET /location/suggest → hiển thị suggestion card trong chat screen
  └─ Permission framing: "Bạn của Kem muốn biết bạn đang ở đâu để gợi ý
       những hoạt động và địa điểm phù hợp với tâm trạng của bạn"

[FastAPI Backend — additions]
  ├─ routes/location.py   — /location/update, /location/suggest
  ├─ routes/admin.py      — /admin (HTML), /admin/api/*
  ├─ migrations/002_location.sql — bảng location_history
  └─ prompts/suggest.txt  — prompt gợi ý địa điểm/hoạt động

[Admin Dashboard — /admin]
  ├─ Login: ADMIN_KEY (sessionStorage)
  ├─ Tab Push: gửi noti thủ công + xem push_log
  ├─ Tab GPS: Leaflet.js map + markers theo thời gian
  ├─ Tab Chat Log: conversations phân trang
  └─ Tab Status: mood_snapshots + push_log timeline
```

---

## Database

### Bảng mới: `location_history`
```sql
CREATE TABLE IF NOT EXISTS location_history (
  id bigserial PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy real,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loc_created ON location_history (created_at DESC);
```

---

## Backend Routes

### `routes/location.py`

**`POST /location/update`**
- Auth: `x-app-key` (dùng shared key như các route hiện tại)
- Body: `{ lat, lng, accuracy }`
- Hành động: INSERT vào `location_history`
- Response: `{ ok: true }`

**`GET /location/suggest`**
- Auth: `x-app-key`
- Flow:
  1. Lấy location mới nhất từ `location_history`
  2. Gọi Overpass API: tìm POI trong bán kính 1km (amenity: cafe, restaurant, park, mall, cinema...)
  3. Lấy mood mới nhất từ `mood_snapshots`
  4. Gọi Claude Haiku với prompt `suggest.txt`: input = [mood + danh sách POI tên/loại/khoảng cách]
  5. Trả về 2-3 gợi ý dạng text tự nhiên theo giọng "Bạn của Kem"
- Response: `{ suggestions: string[] }`
- Edge case: nếu không có location → trả `{ suggestions: [] }`

### `routes/admin.py`

**Auth middleware:** Mọi route `/admin/api/*` kiểm tra header `X-Admin-Key == ADMIN_KEY` env var. Trả 401 nếu sai.

**`GET /admin`** — Serve file HTML dashboard (inline hoặc từ `static/admin.html`)

**`POST /admin/api/push/send`**
- Body: `{ message: string }`
- Gọi Expo push API với token từ TOKEN_FILE
- INSERT vào `push_log`

**`GET /admin/api/push/log`** — Trả `push_log` 50 records gần nhất

**`GET /admin/api/location`** — Trả `location_history` 200 records gần nhất

**`GET /admin/api/chat`** — Trả `conversations` phân trang, query param `?page=0&limit=50`

**`GET /admin/api/status`** — Trả `mood_snapshots` 100 records + push_log 50 records gần nhất

---

## Admin Dashboard UI

Một file HTML duy nhất (vanilla JS + Leaflet.js CDN). Không cần build step.

### Login Screen
- Input `ADMIN_KEY`, lưu vào `sessionStorage` khi submit
- Nếu 401 → xóa key, show lại form

### Tab: Push
- Textarea nhập message thủ công
- Nút "Gửi ngay" → `POST /admin/api/push/send`
- Bảng push_log bên dưới (message, sent_at)

### Tab: GPS Map
- Leaflet.js map, tile từ OpenStreetMap (miễn phí)
- Markers gradient màu theo thời gian: mới = đỏ (#e74c3c), cũ = xanh (#3498db)
- Click marker → popup hiện timestamp + tọa độ
- Auto-fit bounds theo tất cả markers

### Tab: Chat Log
- Danh sách messages, phân trang (50/trang)
- Hiển thị: role (user/assistant), content, mood (nếu có), created_at
- User messages màu khác assistant messages

### Tab: Status
- Mood timeline: list mood_snapshots (mood, confidence, trigger, created_at)
- Push log: list push_log (message, sent_at, opened)

### Refresh
- Polling tự động mỗi 30 giây khi tab đang active
- Nút "Refresh" thủ công

---

## Expo App Additions

### Settings Screen
- Thêm toggle: **"Cho Bạn của Kem biết vị trí của bạn"**
- Subtitle: *"Bạn của Kem sẽ gợi ý hoạt động và địa điểm phù hợp với tâm trạng của bạn"*
- Khi toggle ON lần đầu: xin permission `expo-location` foreground + background
- Nếu user từ chối → toggle tự reset về OFF, show toast giải thích
- Trạng thái lưu trong `SecureStore` (`location_enabled`)

### Background Task
- Dùng `expo-task-manager` + `expo-location` `startLocationUpdatesAsync`
- Task name: `LOCATION_BACKGROUND_UPDATE`
- Interval: 15 phút (900 giây), `deferredUpdatesInterval`
- Khi có update mới: gọi `POST /location/update` (dùng cùng base URL + key từ SecureStore)
- Không update nếu accuracy > 100m (GPS yếu, bỏ qua)

### Suggestion Card
- Trong màn hình chat (index.tsx), thêm button nhỏ hoặc card: **"Bạn của Kem gợi ý cho hôm nay ✨"**
- Chỉ hiển thị khi `location_enabled = true`
- Tap → gọi `GET /location/suggest` → hiển thị modal/bottom sheet với suggestions
- Loading state khi đang fetch

---

## Prompt: `prompts/suggest.txt`

```
Bạn là "Bạn của Kem" — một người bạn thân thiết, ấm áp và tinh tế.
Kem đang ở gần các địa điểm sau:
{poi_list}

Tâm trạng hiện tại của Kem: {mood}

Hãy gợi ý 2-3 hoạt động hoặc địa điểm cụ thể cho Kem, phù hợp với tâm trạng.
Viết ngắn gọn, tự nhiên như một người bạn nhắn tin, không bullet points.
```

---

## Security & Privacy

- `ADMIN_KEY` chỉ tồn tại trong `.env` backend, không bao giờ expose ra client app
- `/admin` route không được log trong production (tránh leak qua log aggregator)
- `location_history` không có tên hay thông tin định danh, chỉ tọa độ + timestamp
- Background location task chỉ chạy khi user đã bật toggle và grant permission

---

## Out of Scope

- Realtime GPS WebSocket
- Geocoding địa chỉ thành tên đường
- Google Places API
- Admin user management (nhiều admin)
- Export data

---

## Files cần tạo/sửa

**Backend:**
- `backend/routes/location.py` — mới
- `backend/routes/admin.py` — mới
- `backend/static/admin.html` — mới
- `backend/migrations/002_location.sql` — mới
- `backend/prompts/suggest.txt` — mới
- `backend/main.py` — include 2 router mới
- `backend/config.py` — thêm `admin_key` setting

**App:**
- `app/app/(tabs)/settings.tsx` — thêm GPS toggle
- `app/lib/location.ts` — mới (background task logic)
- `app/app/(tabs)/index.tsx` — thêm suggestion card
