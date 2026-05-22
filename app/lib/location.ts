import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";

const TASK_NAME = "LOCATION_BACKGROUND_UPDATE";
const LOCATION_ENABLED_KEY = "LOCATION_ENABLED";

// Called by TaskManager when a background location update fires
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
    timeInterval: 15 * 60 * 1000, // 15 minutes
    distanceInterval: 200,         // or 200m moved
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
