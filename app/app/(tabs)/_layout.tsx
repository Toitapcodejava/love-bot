import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useShakeNavigation } from "@/lib/shake";

const TAB_CONFIG = [
  { name: "index",    emoji: "💬", label: "Chat"    },
  { name: "memory",   emoji: "🔖", label: "Ký ức"   },
  { name: "rage",     emoji: "🔥", label: "Đập"     },
  { name: "gps",      emoji: "📍", label: "GPS"     },
  { name: "settings", emoji: "⚙️", label: "Cài đặt" },
];

function EmojiTabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 4 }}>
      {focused && (
        <LinearGradient
          colors={["#7aa2f7", "#bb9af7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: "absolute", top: -8, width: 20, height: 3, borderRadius: 2,
          }}
        />
      )}
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.35 }}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  useShakeNavigation();

  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: "#0a0a0a", borderTopColor: "#1a1a2e", borderTopWidth: 1 },
      tabBarActiveTintColor: "#7aa2f7",
      tabBarInactiveTintColor: "#555",
      tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      headerShown: false,
    }}>
      {TAB_CONFIG.map(tab => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{
          title: tab.label,
          tabBarIcon: ({ focused }) => (
            <EmojiTabIcon emoji={tab.emoji} label={tab.label} focused={focused} />
          ),
        }} />
      ))}
    </Tabs>
  );
}
