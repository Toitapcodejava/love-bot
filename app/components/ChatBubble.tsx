import { Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

export function ChatBubble({ role, content }: { role: "user"|"assistant"; content: string }) {
  const { palette } = useTheme();
  const isUser = role === "user";
  return (
    <View style={{
      alignSelf: isUser ? "flex-end" : "flex-start",
      backgroundColor: isUser ? palette.accent : "#222",
      padding: 10, borderRadius: 12, marginVertical: 4, maxWidth: "80%",
    }}>
      <Text style={{ color: palette.fg }}>{content}</Text>
    </View>
  );
}
