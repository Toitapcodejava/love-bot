import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { postJSON } from "./api";

export async function registerForPush() {
  if (!Device.isDevice) return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    try { await postJSON("/push/register", { token }); } catch {}
  } catch (e) {
    // Firebase not configured yet — push notifications disabled
    console.warn("Push registration skipped:", e);
  }
}
