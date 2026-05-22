# Native Production Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa 7 điểm code tạm/sai trên native Android trước khi build APK final — bao gồm push notification handler, SecureStore dynamic import, MapView error fallback, background location restart sau reboot, permissions trong app.json, và expo-sensors plugin.

**Architecture:** Thay đổi trải rộng trên 4 file: `app.json` (config), `lib/location.ts` (business logic), `app/_layout.tsx` (app shell), `app/(tabs)/gps.tsx` (UI). Không có dependency giữa Task 1 và Task 2. Task 3 phụ thuộc Task 2 (import hàm mới). Task 4 độc lập hoàn toàn. Thứ tự an toàn nhất: Task 1 → Task 2 → Task 3 → Task 4.

**Tech Stack:** Expo ~56 managed workflow, EAS Build, React Native, expo-location, expo-task-manager, expo-notifications, expo-secure-store, react-native-maps

---

## File Map

| File | Thay đổi |
|------|----------|
| `app/app.json` | Thêm permissions + expo-sensors plugin |
| `app/lib/location.ts` | Thêm hàm `restartLocationIfNeeded()` |
| `app/app/_layout.tsx` | Static SecureStore import, setNotificationHandler, gọi restartLocationIfNeeded |
| `app/app/(tabs)/gps.tsx` | MapView onError + fallback UI, xóa timeInterval thừa |

---

## Task 1: Cập nhật `app.json` — permissions và expo-sensors plugin

**Files:**
- Modify: `app/app.json`

- [ ] **Step 1: Mở file và xác nhận vị trí cần sửa**

  Mở `app/app.json`. Có 2 chỗ cần sửa:
  - Mảng `expo.android.permissions` (hiện chỉ có `VIBRATE`, `RECEIVE_BOOT_COMPLETED`)
  - Mảng `expo.plugins` (cần thêm `"expo-sensors"`)

- [ ] **Step 2: Thêm permissions vào `android.permissions`**

  Thay thế block `android.permissions` hiện tại:
  ```json
  "permissions": [
    "VIBRATE",
    "RECEIVE_BOOT_COMPLETED"
  ]
  ```

  Thành:
  ```json
  "permissions": [
    "VIBRATE",
    "RECEIVE_BOOT_COMPLETED",
    "ACCESS_FINE_LOCATION",
    "ACCESS_COARSE_LOCATION",
    "ACCESS_BACKGROUND_LOCATION",
    "FOREGROUND_SERVICE",
    "FOREGROUND_SERVICE_LOCATION"
  ]
  ```

- [ ] **Step 3: Thêm `expo-sensors` vào plugins**

  Mảng `plugins` hiện tại kết thúc bằng block `expo-splash-screen`. Thêm `"expo-sensors"` vào cuối mảng:

  ```json
  "plugins": [
    "expo-router",
    [
      "expo-notifications",
      {
        "sounds": []
      }
    ],
    "expo-secure-store",
    [
      "expo-location",
      {
        "locationAlwaysAndWhenInUsePermission": "Bạn của Kem muốn biết bạn đang ở đâu để gợi ý những hoạt động và địa điểm phù hợp với tâm trạng của bạn.",
        "locationWhenInUsePermission": "Bạn của Kem muốn biết bạn đang ở đâu để gợi ý những hoạt động và địa điểm phù hợp với tâm trạng của bạn.",
        "isIosBackgroundLocationEnabled": true,
        "isAndroidBackgroundLocationEnabled": true
      }
    ],
    [
      "expo-splash-screen",
      {
        "image": "./assets/images/splash-icon.png",
        "resizeMode": "contain",
        "backgroundColor": "#0a0a0a"
      }
    ],
    "expo-sensors"
  ]
  ```

- [ ] **Step 4: Verify JSON hợp lệ**

  Chạy từ thư mục `app/`:
  ```bash
  node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('JSON valid')"
  ```
  Expected output: `JSON valid`

- [ ] **Step 5: Commit**

  ```bash
  git add app/app.json
  git commit -m "fix: add native permissions and expo-sensors plugin to app.json"
  ```

---

## Task 2: Thêm `restartLocationIfNeeded()` vào `lib/location.ts`

**Files:**
- Modify: `app/lib/location.ts`

- [ ] **Step 1: Đọc file hiện tại**

  Mở `app/lib/location.ts`. File hiện có các hàm: `isLocationEnabled`, `enableLocation`, `disableLocation`, `fetchSuggestions`. Cần thêm hàm `restartLocationIfNeeded` sau `disableLocation`.

- [ ] **Step 2: Thêm hàm `restartLocationIfNeeded`**

  Thêm hàm sau `disableLocation` (trước `fetchSuggestions`):

  ```ts
  export async function restartLocationIfNeeded(): Promise<void> {
    const enabled = await isLocationEnabled();
    if (!enabled) return;

    const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
    if (isRunning) return;

    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15 * 60 * 1000,
      distanceInterval: 200,
      deferredUpdatesInterval: 15 * 60 * 1000,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: "Bạn của Kem",
        notificationBody: "Đang cập nhật vị trí",
      },
    });
  }
  ```

  Sau bước này, file `app/lib/location.ts` trông như sau (toàn bộ file):

  ```ts
  import * as Location from "expo-location";
  import * as TaskManager from "expo-task-manager";
  import * as SecureStore from "expo-secure-store";

  const TASK_NAME = "LOCATION_BACKGROUND_UPDATE";
  const LOCATION_ENABLED_KEY = "LOCATION_ENABLED";

  TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
    if (error || !data?.locations?.length) return;
    const loc = data.locations[0];
    if (loc.coords.accuracy && loc.coords.accuracy > 100) return;

    const base = await SecureStore.getItemAsync("BASE_URL") ?? "";
    const key = await SecureStore.getItemAsync("APP_KEY") ?? "";
    if (!base || !key) return;

    try {
      await fetch(`${base}/location/update`, {
        method: "POST",
        headers: { "x-app-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        }),
      });
    } catch {
      // silently ignore network errors in background task
    }
  });

  export async function isLocationEnabled(): Promise<boolean> {
    const v = await SecureStore.getItemAsync(LOCATION_ENABLED_KEY);
    return v === "1";
  }

  export async function enableLocation(): Promise<boolean> {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== "granted") return false;

    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== "granted") return false;

    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15 * 60 * 1000,
      distanceInterval: 200,
      deferredUpdatesInterval: 15 * 60 * 1000,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: "Bạn của Kem",
        notificationBody: "Đang cập nhật vị trí",
      },
    });

    await SecureStore.setItemAsync(LOCATION_ENABLED_KEY, "1");
    return true;
  }

  export async function disableLocation(): Promise<void> {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
    }
    await SecureStore.setItemAsync(LOCATION_ENABLED_KEY, "0");
  }

  export async function restartLocationIfNeeded(): Promise<void> {
    const enabled = await isLocationEnabled();
    if (!enabled) return;

    const isRunning = await Location.hasStartedLocationUpdatesAsync(TASK_NAME).catch(() => false);
    if (isRunning) return;

    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15 * 60 * 1000,
      distanceInterval: 200,
      deferredUpdatesInterval: 15 * 60 * 1000,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: "Bạn của Kem",
        notificationBody: "Đang cập nhật vị trí",
      },
    });
  }

  export async function fetchSuggestions(base: string, key: string): Promise<string[]> {
    const r = await fetch(`${base}/location/suggest`, {
      headers: { "x-app-key": key },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return data.suggestions ?? [];
  }
  ```

- [ ] **Step 3: Verify TypeScript**

  Chạy từ thư mục `app/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: không có error liên quan đến `location.ts`.

- [ ] **Step 4: Commit**

  ```bash
  git add app/lib/location.ts
  git commit -m "fix: add restartLocationIfNeeded for post-reboot background location recovery"
  ```

---

## Task 3: Sửa `app/_layout.tsx` — notification handler + static import + restart location

**Files:**
- Modify: `app/app/_layout.tsx`

Có 3 thay đổi độc lập trong file này, thực hiện cùng một lần:
1. Thêm `setNotificationHandler` ở module scope
2. Đổi dynamic import SecureStore → static import
3. Gọi `restartLocationIfNeeded()` khi `AppShell` mount

- [ ] **Step 1: Mở file và xác nhận vị trí cần sửa**

  Mở `app/app/_layout.tsx`. Tìm:
  - Dòng `import * as SplashScreen from "expo-splash-screen";` (khu vực imports)
  - Dòng `const { default: SecureStore } = await import("expo-secure-store");` (bên trong `initQuote`)
  - Hàm `AppShell` và các `useEffect` bên trong nó

- [ ] **Step 2: Thay thế toàn bộ nội dung `app/app/_layout.tsx`**

  Đây là file hoàn chỉnh sau khi sửa. Ghi đè toàn bộ:

  ```tsx
  import { useFonts } from "expo-font";
  import { Stack } from "expo-router";
  import * as SplashScreen from "expo-splash-screen";
  import * as Notifications from "expo-notifications";
  import * as SecureStore from "expo-secure-store";
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
  import { restartLocationIfNeeded } from "@/lib/location";

  export { ErrorBoundary } from "expo-router";

  export const unstable_settings = { initialRouteName: "(tabs)" };

  SplashScreen.preventAutoHideAsync();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

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
      restartLocationIfNeeded();
    }, []);

    useEffect(() => {
      if (!loaded) return;

      async function initQuote() {
        try {
          const base = await storage.getBase();
          if (!base) return;

          const mode = (await SecureStore.getItemAsync("PERSONA_MODE")) ?? "tsundere";

          if (mode !== "silent_beauty") {
            if (isStale(status)) setShowCheckIn(true);
            return;
          }

          setShowQuote(true);
          pendingCheckIn.current = isStale(status);

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          try {
            const data = await getJSON("/api/quotes/daily");
            setQuoteText(data.quote ?? "");
          } catch {
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

- [ ] **Step 3: Verify TypeScript**

  Chạy từ thư mục `app/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: không có error liên quan đến `_layout.tsx`.

- [ ] **Step 4: Commit**

  ```bash
  git add app/app/_layout.tsx
  git commit -m "fix: add notification handler, static SecureStore import, restart location on init"
  ```

---

## Task 4: Sửa `app/(tabs)/gps.tsx` — MapView error handler + xóa timeInterval

**Files:**
- Modify: `app/app/(tabs)/gps.tsx`

- [ ] **Step 1: Thêm `onError` vào `<MapView>`**

  Tìm block `<MapView ...>` (khoảng line 122–134). Thêm prop `onError`:

  ```tsx
  <MapView
    style={{ height: 200, margin: 16, borderRadius: 12 }}
    region={{
      latitude: location.lat,
      longitude: location.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }}
    scrollEnabled={false}
    zoomEnabled={false}
    onMapReady={() => setMapError(false)}
    onError={() => setMapError(true)}
  >
    <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} />
  </MapView>
  ```

- [ ] **Step 2: Thêm fallback UI khi `mapError === true`**

  Tìm đoạn kết thúc `</MapView>` (có `}`  đóng điều kiện `{location && !mapError && (...)}` bên ngoài). Ngay sau block MapView đó, thêm block fallback:

  ```tsx
  {location && mapError && (
    <View
      style={{
        height: 200,
        margin: 16,
        borderRadius: 12,
        backgroundColor: "#111",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#222",
      }}
    >
      <Text style={{ color: "#555", fontSize: 13 }}>Không tải được bản đồ</Text>
    </View>
  )}
  ```

- [ ] **Step 3: Xóa `timeInterval` thừa trong `getCurrentPositionAsync`**

  Tìm đoạn (khoảng line 48–51):
  ```ts
  pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000,
  });
  ```

  Sửa thành:
  ```ts
  pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  ```

- [ ] **Step 4: Verify TypeScript**

  Chạy từ thư mục `app/`:
  ```bash
  npx tsc --noEmit
  ```
  Expected: không có error liên quan đến `gps.tsx`.

- [ ] **Step 5: Commit**

  ```bash
  git add app/app/(tabs)/gps.tsx
  git commit -m "fix: add MapView error handler with fallback UI, remove unused timeInterval"
  ```

---

## Checklist cuối — trước khi build APK

Sau khi hoàn thành 4 task trên, xác nhận lại:

- [ ] `npx tsc --noEmit` từ thư mục `app/` — không có error
- [ ] `app.json` có đủ 7 permissions trong `android.permissions`
- [ ] `app.json` có `"expo-sensors"` trong `plugins`
- [ ] `app/_layout.tsx` có `Notifications.setNotificationHandler` ở module scope (ngoài mọi component/function)
- [ ] `app/_layout.tsx` không còn dòng `await import("expo-secure-store")`
- [ ] `app/_layout.tsx` có `import * as SecureStore from "expo-secure-store"` ở đầu file
- [ ] `app/_layout.tsx` gọi `restartLocationIfNeeded()` trong `useEffect([], [])` của `AppShell`
- [ ] `app/lib/location.ts` export `restartLocationIfNeeded`
- [ ] `app/(tabs)/gps.tsx` có `onError={() => setMapError(true)}` trong `<MapView>`
- [ ] `app/(tabs)/gps.tsx` có fallback UI khi `mapError === true`
- [ ] `app/(tabs)/gps.tsx` không còn `timeInterval: 15000` trong `getCurrentPositionAsync`

- [ ] **Commit cuối nếu chưa commit hết:**
  ```bash
  git log --oneline -5
  ```
  Xác nhận 4 commit đã có mặt trong log.
