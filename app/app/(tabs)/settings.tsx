import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { storage } from "@/lib/storage";
import { useTheme, ThemeMode } from "@/lib/theme";
import { isLocationEnabled, enableLocation, disableLocation } from "@/lib/location";

const MODES: ThemeMode[] = ["chaos", "dark", "calm", "red_alert"];

export default function Settings() {
  const { mode, set, palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [base, setBase] = useState("");
  const [key, setKey] = useState("");
  const [locationOn, setLocationOn] = useState(false);

  useEffect(() => {
    storage.getBase().then(setBase);
    storage.getKey().then(setKey);
    isLocationEnabled().then(setLocationOn);
  }, []);

  async function save() {
    await storage.setBase(base.trim());
    await storage.setKey(key.trim());
    Alert.alert("ok", "đã lưu");
  }

  async function toggleLocation(value: boolean) {
    if (value) {
      const ok = await enableLocation();
      if (!ok) {
        Alert.alert(
          "Không thể bật",
          "Bạn của Kem cần quyền truy cập vị trí. Vui lòng cấp quyền trong Cài đặt."
        );
        return;
      }
    } else {
      await disableLocation();
    }
    setLocationOn(value);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, gap: 12 }}
    >
      <Text style={{ color: palette.fg, fontSize: 14 }}>Backend URL</Text>
      <TextInput value={base} onChangeText={setBase} autoCapitalize="none"
        style={{ color: palette.fg, backgroundColor: "#222", padding: 10, borderRadius: 8 }} />
      <Text style={{ color: palette.fg, fontSize: 14 }}>App Key</Text>
      <TextInput value={key} onChangeText={setKey} autoCapitalize="none" secureTextEntry
        style={{ color: palette.fg, backgroundColor: "#222", padding: 10, borderRadius: 8 }} />
      <Pressable onPress={save} style={{ backgroundColor: palette.accent, padding: 12, borderRadius: 8 }}>
        <Text style={{ color: palette.fg, textAlign: "center" }}>Lưu</Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: "#111", padding: 12, borderRadius: 8, marginTop: 8 }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ color: palette.fg, fontSize: 14 }}>Cho Bạn của Kem biết vị trí</Text>
          <Text style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
            Bạn của Kem sẽ gợi ý hoạt động và địa điểm phù hợp với tâm trạng của bạn
          </Text>
        </View>
        <Switch
          value={locationOn}
          onValueChange={toggleLocation}
          trackColor={{ false: "#333", true: palette.accent }}
          thumbColor={locationOn ? "#fff" : "#888"}
        />
      </View>

      <Text style={{ color: palette.fg, marginTop: 8 }}>Theme</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MODES.map(m => (
          <Pressable key={m} onPress={() => set(m)}
            style={{ padding: 8, borderRadius: 6, backgroundColor: m === mode ? palette.accent : "#222" }}>
            <Text style={{ color: palette.fg }}>{m}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
