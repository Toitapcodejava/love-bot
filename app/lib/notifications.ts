import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { postJSON } from "./api";

export async function registerForPush() {
  if (!Device.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  try { await postJSON("/push/register", { token }); } catch {}
}
