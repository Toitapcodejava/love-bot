import { useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { storage } from "@/lib/storage";
import { useTheme } from "@/lib/theme";

type GPSState = "idle" | "loading" | "ready" | "error";

type LocationData = {
  lat: number;
  lng: number;
  accuracy: number | null;
  address: string;
  updatedAt: Date;
};

export default function GPS() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GPSState>("idle");
  const [location, setLocation] = useState<LocationData | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function fetchLocation() {
    setState("loading");
    setErrorMsg("");

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setState("error");
      setErrorMsg("Bạn của Kem cần quyền truy cập vị trí.");
      return;
    }

    let pos: Location.LocationObject;
    try {
      pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
      });
    } catch {
      setState("error");
      setErrorMsg("Không lấy được vị trí. Thử lại?");
      return;
    }

    const { latitude: lat, longitude: lng, accuracy } = pos.coords;

    // Reverse geocode
    let address = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo.length > 0) {
        const g = geo[0];
        const parts = [g.street, g.district, g.city].filter(Boolean);
        if (parts.length > 0) address = parts.join(", ");
      }
    } catch {
      // keep default address
    }

    // POST to backend
    const base = await storage.getBase();
    const key = await storage.getKey();
    try {
      await fetch(`${base}/location/update`, {
        method: "POST",
        headers: { "x-app-key": key, "content-type": "application/json" },
        body: JSON.stringify({ lat, lng, accuracy }),
      });
    } catch {
      // silently ignore — location still usable locally
    }

    setLocation({ lat, lng, accuracy: accuracy ?? null, address, updatedAt: new Date() });
    setState("ready");
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top }}>
      <Text style={{ color: palette.fg, fontSize: 17, fontWeight: "700", padding: 16 }}>
        📍 Vị trí hiện tại
      </Text>
      <Text style={{ color: palette.fg, padding: 16 }}>State: {state}</Text>
    </View>
  );
}
