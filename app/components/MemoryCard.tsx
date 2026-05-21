import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/lib/theme";

export function MemoryCard({ item, onDelete }: { item: any; onDelete: () => void }) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: "row", padding: 12, backgroundColor: "#1c1c1c",
                   marginVertical: 4, borderRadius: 8, alignItems: "center" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.fg, fontSize: 14 }}>{item.content}</Text>
        <Text style={{ color: "#888", fontSize: 11, marginTop: 4 }}>
          {item.tag}{item.pinned ? " · 📌 seed" : ""}
        </Text>
      </View>
      {!item.pinned && (
        <Pressable onPress={onDelete} style={{ padding: 8 }}>
          <Text style={{ color: palette.accent }}>🗑</Text>
        </Pressable>
      )}
    </View>
  );
}
