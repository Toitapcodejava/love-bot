import { useState } from "react";
import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import MapView, { Marker } from "react-native-maps";
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

function formatRelativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  return `${Math.floor(diff / 3600)} giờ trước`;
}

export default function GPS() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GPSState>("idle");
  const [location, setLocation] = useState<LocationData | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [mapError, setMapError] = useState(false);

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

    // Fetch suggestions
    try {
      const r = await fetch(`${base}/location/suggest`, {
        headers: { "x-app-key": key },
      });
      if (r.ok) {
        const data = await r.json();
        setSuggestions(data.suggestions ?? []);
      }
    } catch {
      // suggestions are non-critical
    }

    setState("ready");
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}>
        <Text style={{ color: palette.fg, fontSize: 17, fontWeight: "700" }}>📍 Vị trí hiện tại</Text>
        <Text style={{ color: palette.accent, fontSize: 12, marginTop: 2 }}>
          {location
            ? `● GPS: BẬT  •  Cập nhật: ${formatRelativeTime(location.updatedAt)}`
            : "● GPS: chưa bật"}
        </Text>
      </View>

      {/* Map */}
      {location && !mapError && (
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
          {...{ onError: () => setMapError(true) }}
        >
          <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} />
        </MapView>
      )}

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

      {/* Coordinates */}
      {location && (
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ color: palette.fg, fontSize: 14 }}>
            {location.lat.toFixed(5)}° N, {location.lng.toFixed(5)}° E
            {location.accuracy !== null ? `  ±${Math.round(location.accuracy)}m` : ""}
          </Text>
          <Text style={{ color: palette.accent, fontSize: 13, marginTop: 2 }}>{location.address}</Text>
        </View>
      )}

      {/* Error */}
      {state === "error" && (
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <Text style={{ color: "#e06c75", fontSize: 14 }}>{errorMsg}</Text>
          {errorMsg.includes("quyền") && (
            <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 8 }}>
              <Text style={{ color: palette.accent, fontSize: 13 }}>Mở Cài đặt →</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Update button */}
      <Pressable
        onPress={fetchLocation}
        disabled={state === "loading"}
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          padding: 12,
          backgroundColor: state === "loading" ? "#222" : palette.surface,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: palette.border,
          alignItems: "center",
        }}
      >
        <Text style={{ color: state === "loading" ? "#555" : palette.accent, fontSize: 14 }}>
          {state === "loading" ? "Đang lấy vị trí..." : "🔄 Cập nhật vị trí ngay"}
        </Text>
      </Pressable>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: palette.fg, fontSize: 15, fontWeight: "700", marginBottom: 10 }}>
            ✨ Gợi ý hôm nay
          </Text>
          {suggestions.map((s, i) => (
            <Text key={i} style={{ color: palette.fg, fontSize: 13, lineHeight: 20, marginBottom: 6 }}>
              • {s}
            </Text>
          ))}
        </View>
      )}

      {/* Idle placeholder */}
      {state === "idle" && (
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: "#555", fontSize: 13 }}>
            Bấm nút trên để lấy vị trí và gợi ý địa điểm.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
