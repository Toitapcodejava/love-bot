import * as Haptics from "expo-haptics";
import { Linking } from "react-native";
import type { ToolCall } from "./api";

let setThemeMode: (m: any) => void = () => {};
export function bindThemeSetter(fn: (m: any) => void) { setThemeMode = fn; }

export async function executeTools(tools: ToolCall[]) {
  for (const t of tools) {
    try {
      switch (t.name) {
        case "trigger_haptic": {
          const p = t.args.pattern;
          if (p === "heavy") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          else if (p === "double") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 120);
          } else {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          break;
        }
        case "change_theme": setThemeMode(t.args.mode); break;
        case "suggest_song": {
          const q = encodeURIComponent(t.args.query);
          Linking.openURL(`https://www.youtube.com/results?search_query=${q}`);
          break;
        }
        case "memory_save": break;
        case "web_search": break; // handled backend-side
      }
    } catch (e) { console.warn("tool error", t.name, e); }
  }
}
