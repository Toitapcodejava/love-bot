# GPS Tab Design

**Date:** 2026-05-22  
**Status:** Approved

## Problem

The existing GPS flow uses an Expo background location task (`TaskManager`) which does not run in Expo Go. As a result, no location data is ever sent to the backend during development testing, so the admin dashboard GPS section is always empty and `/location/suggest` always falls back to memories.

## Solution

Add a dedicated GPS tab (`app/(tabs)/gps.tsx`) that uses **foreground location** (`Location.getCurrentPositionAsync`). This works in Expo Go without any additional permissions beyond foreground. The background task in `app/lib/location.ts` is left intact for production builds.

## Architecture

### Data Flow

```
User opens GPS tab
  → requestForegroundPermissionsAsync()   (if not already granted)
  → getCurrentPositionAsync()             (timeout: 15s)
  → POST /location/update                 (save to DB)
  → GET /location/suggest                 (AI suggestions using new location)
  → Render MapView + coords + suggestions
```

### Components

- **`app/(tabs)/gps.tsx`** — new tab, self-contained, no shared state with chat tab
- **`app/lib/location.ts`** — unchanged; background task remains for production

### Backend

No backend changes required. Both the foreground tab and background task POST to the same `/location/update` endpoint.

## UI Layout

```
┌─────────────────────────────────────┐
│  📍 Vị trí hiện tại                 │
│  ● GPS: BẬT  •  Cập nhật: 3 phút   │
├─────────────────────────────────────┤
│         [MapView 200px tall]        │
│         (single Marker at position) │
├─────────────────────────────────────┤
│  21.0285° N, 105.8341° E  ±12m     │
│  Cầu Giấy, Hà Nội                  │
│                                     │
│  [🔄 Cập nhật vị trí ngay]          │
├─────────────────────────────────────┤
│  ✨ Gợi ý hôm nay                   │
│  • Đi bộ ở Công viên Cầu Giấy      │
│  • Ghé The Coffee House gần đây     │
└─────────────────────────────────────┘
```

### Tab States

| State | Description |
|-------|-------------|
| `idle` | No location yet. Show "Bật GPS" button. |
| `loading` | Fetching location + suggestions. Show spinner. |
| `ready` | Data available. Show map, coords, suggestions. |
| `error` | Permission denied or timeout. Show message + retry. |

### Map

- Use `react-native-maps` (bundled in Expo SDK, works in Expo Go)
- Single `Marker` at current position, no interaction needed
- If `MapView` fails to render → hide map section, show coords text only

### Reverse Geocode

- Use `Location.reverseGeocodeAsync()` from `expo-location`
- Shows street/district name below coordinates
- No API key required

## Error Handling

**Permission denied:**
- Show explanation message
- Show "Mở Settings" button via `Linking.openSettings()`
- No automatic retry

**GPS timeout (>15s) or no signal:**
- Show "Không lấy được vị trí. Thử lại?" message
- Manual retry button only

**Overpass/suggestion API failure:**
- Backend already handles this: falls back to memories when no POI available
- App renders whatever suggestions are returned; no special handling needed

**Background task + GPS tab coexistence:**
- Both write to the same `/location/update` endpoint independently
- No conflict; most-recent-wins behavior in `location_history` table is acceptable

## Out of Scope

- Continuous/automatic location updates while tab is open (Hướng C — not chosen)
- Development build setup (`eas build`) — user can do this separately when needed
- Admin dashboard changes — already displays GPS data correctly once data arrives
