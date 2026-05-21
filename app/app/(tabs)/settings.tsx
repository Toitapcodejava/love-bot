import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { storage } from "@/lib/storage";
import { useTheme, ThemeMode } from "@/lib/theme";

const MODES: ThemeMode[] = ["chaos", "dark", "calm", "red_alert"];

export default function Settings() {
  const { mode, set, palette } = useTheme();
  const [base, setBase] = useState("");
  const [key, setKey] = useState("");
  useEffect(() => { storage.getBase().then(setBase); storage.getKey().then(setKey); }, []);

  async function save() {
    await storage.setBase(base.trim());
    await storage.setKey(key.trim());
    Alert.alert("ok", "đã lưu");
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 16, gap: 12 }}>
      <Text style={{ color: palette.fg, fontSize: 14 }}>Backend URL</Text>
      <TextInput value={base} onChangeText={setBase} autoCapitalize="none"
        style={{ color: palette.fg, backgroundColor: "#222", padding: 10, borderRadius: 8 }} />
      <Text style={{ color: palette.fg, fontSize: 14 }}>App Key</Text>
      <TextInput value={key} onChangeText={setKey} autoCapitalize="none" secureTextEntry
        style={{ color: palette.fg, backgroundColor: "#222", padding: 10, borderRadius: 8 }} />
      <Pressable onPress={save} style={{ backgroundColor: palette.accent, padding: 12, borderRadius: 8 }}>
        <Text style={{ color: palette.fg, textAlign: "center" }}>Lưu</Text>
      </Pressable>
      <Text style={{ color: palette.fg, marginTop: 16 }}>Theme</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MODES.map(m => (
          <Pressable key={m} onPress={() => set(m)}
            style={{ padding: 8, borderRadius: 6, backgroundColor: m === mode ? palette.accent : "#222" }}>
            <Text style={{ color: palette.fg }}>{m}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
