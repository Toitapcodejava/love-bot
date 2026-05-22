import { useState, useRef, useEffect } from "react";
import {
  View, TextInput, Pressable, Text, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { chatStream, MoodData } from "@/lib/api";
import { ChatBubble } from "@/components/ChatBubble";
import { Avatar, Mood } from "@/components/Avatar";
import { TypingIndicator } from "@/components/TypingIndicator";
import { StatusChip } from "@/components/StatusChip";
import { useUserStatus, statusContext, UserStatus } from "@/lib/userStatus";
import { useTheme } from "@/lib/theme";
import { executeTools } from "@/lib/toolExecutor";

type Msg = {
  role: "user" | "assistant";
  content: string;
  reactionEmoji?: string;
};

const FIRST_RUN_KEY = "FIRST_RUN_DONE";

export default function Chat() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { status, setStatus } = useUserStatus();
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Lâu không thấy. Lại có chuyện gì rồi à?" }
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [mood, setMood] = useState<Mood>("neutral");
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const done = await SecureStore.getItemAsync(FIRST_RUN_KEY);
      if (!done) {
        setMsgs([{ role: "assistant", content: "Ờ. Thằng dev nó làm cái này cho mày. Đừng cảm động vội — tao là loại khó tính. Bắt đầu kể đi, Kem." }]);
        await SecureStore.setItemAsync(FIRST_RUN_KEY, "1");
      }
    })();
  }, []);

  async function send(text?: string) {
    const user = (text ?? input).trim();
    if (!user || streaming) return;
    setInput("");
    setMsgs(m => [...m, { role: "user", content: user }, { role: "assistant", content: "" }]);
    setStreaming(true);
    setMood("thinking");
    await chatStream(
      user,
      (t) => setMsgs(m => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + t };
        return copy;
      }),
      (tools) => executeTools(tools),
      (moodData: MoodData) => {
        setMood(moodData.mood as Mood);
        setMsgs(m => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], reactionEmoji: moodData.reaction_emoji };
          return copy;
        });
      },
      () => setStreaming(false),
      (e) => { console.error(e); setStreaming(false); setMood("neutral"); },
      statusContext(status),
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: palette.bg }}
    >
      {/* Header */}
      <View style={{
        paddingTop: insets.top,
        backgroundColor: palette.bg,
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}>
        <Avatar mood={mood} streaming={streaming} size={42} />
        <View>
          <Text style={{ color: palette.fg, fontSize: 15, fontWeight: "700" }}>Bạn của Kem</Text>
          {streaming
            ? <TypingIndicator showLabel={true} />
            : <Text style={{ color: palette.accent, fontSize: 11 }}>● online</Text>
          }
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
      >
        {msgs.map((m, i) => (
          <ChatBubble
            key={i}
            role={m.role}
            content={m.content}
            reactionEmoji={m.reactionEmoji}
            isLatest={i === msgs.length - 1}
          />
        ))}
      </ScrollView>

      {/* Status chip row — only when status exists */}
      {status && (
        <StatusChip
          status={status}
          onUpdate={(s: UserStatus) => setStatus(s)}
        />
      )}

      {/* Input bar */}
      <View style={{
        flexDirection: "row",
        padding: 10,
        paddingBottom: insets.bottom || 10,
        gap: 8,
        backgroundColor: palette.bg,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        alignItems: "flex-end",
      }}>
        <TouchableOpacity onPress={() => send("😤")} style={{ paddingBottom: 6 }}>
          <Text style={{ fontSize: 22 }}>😤</Text>
        </TouchableOpacity>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="nói đi..."
          placeholderTextColor="#555"
          multiline
          style={{
            flex: 1,
            color: palette.fg,
            backgroundColor: palette.surface,
            padding: 10,
            borderRadius: 20,
            maxHeight: 100,
            borderWidth: 1,
            borderColor: palette.border,
          }}
          onSubmitEditing={() => send()}
        />

        <Pressable
          onPress={() => send()}
          disabled={streaming}
          style={{
            width: 42, height: 42, borderRadius: 21,
            alignItems: "center", justifyContent: "center",
            backgroundColor: streaming ? "#333" : palette.accent,
            overflow: "hidden",
          }}
        >
          {!streaming && (
            <View style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: "50%",
              backgroundColor: palette.accent2,
            }} />
          )}
          <Text style={{ color: "#fff", fontSize: 18 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
