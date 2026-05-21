import { useState, useRef, useEffect } from "react";
import { View, TextInput, Pressable, Text, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { chatStream } from "@/lib/api";
import { ChatBubble } from "@/components/ChatBubble";
import { useTheme } from "@/lib/theme";
import { executeTools } from "@/lib/toolExecutor";

type Msg = { role: "user"|"assistant"; content: string };

const FIRST_RUN_KEY = "FIRST_RUN_DONE";

export default function Chat() {
  const { palette } = useTheme();
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Lâu không thấy. Lại có chuyện gì rồi à?" }
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const done = await SecureStore.getItemAsync(FIRST_RUN_KEY);
      if (!done) {
        setMsgs([{ role: "assistant", content: "Ờ. Thằng dev nó làm cái này cho mày. Đừng cảm động vội — tao là loại khó tính. Bắt đầu kể đi." }]);
        await SecureStore.setItemAsync(FIRST_RUN_KEY, "1");
      }
    })();
  }, []);

  async function send() {
    if (!input.trim() || streaming) return;
    const user = input.trim();
    setInput("");
    setMsgs(m => [...m, { role: "user", content: user }, { role: "assistant", content: "" }]);
    setStreaming(true);
    await chatStream(
      user,
      (t) => setMsgs(m => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + t };
        return copy;
      }),
      (tools) => executeTools(tools),
      () => setStreaming(false),
      (e) => { console.error(e); setStreaming(false); },
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        style={{ padding: 12 }}>
        {msgs.map((m, i) => <ChatBubble key={i} role={m.role} content={m.content} />)}
      </ScrollView>
      <View style={{ flexDirection: "row", padding: 8, gap: 8 }}>
        <TextInput value={input} onChangeText={setInput} placeholder="nói đi..."
          placeholderTextColor="#888"
          style={{ flex: 1, color: palette.fg, backgroundColor: "#222", padding: 10, borderRadius: 8 }}
          onSubmitEditing={send} />
        <Pressable onPress={send}
          style={{ backgroundColor: palette.accent, padding: 10, borderRadius: 8 }}>
          <Text style={{ color: palette.fg }}>gửi</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
