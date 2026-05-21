import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { getJSON, deleteJSON } from "@/lib/api";
import { MemoryCard } from "@/components/MemoryCard";
import { useTheme } from "@/lib/theme";

export default function Memory() {
  const { palette } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try { setItems(await getJSON("/memory")); } catch {}
    setRefreshing(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 12 }}>
      <Text style={{ color: palette.fg, fontSize: 18, marginBottom: 8 }}>
        App đang nhớ về mày ({items.length})
      </Text>
      <FlatList data={items} keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={palette.fg} />}
        renderItem={({ item }) => <MemoryCard item={item} onDelete={async () => {
          await deleteJSON(`/memory/${item.id}`); load();
        }} />}
      />
    </View>
  );
}
