import { Tabs } from 'expo-router';
import { useShakeNavigation } from '@/lib/shake';

export default function TabLayout() {
  useShakeNavigation();

  return (
    <Tabs screenOptions={{ tabBarStyle: { backgroundColor: "#0a0a0a", borderTopColor: "#222" },
                           tabBarActiveTintColor: "#ff2d55", tabBarInactiveTintColor: "#666",
                           headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Chat" }} />
      <Tabs.Screen name="memory" options={{ title: "Ký ức" }} />
      <Tabs.Screen name="rage" options={{ title: "Đập" }} />
      <Tabs.Screen name="settings" options={{ title: "Cài đặt" }} />
    </Tabs>
  );
}
