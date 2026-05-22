import { useState } from "react";
import {
  Modal, View, Text, Pressable, TextInput,
  StyleSheet, Platform, KeyboardAvoidingView,
} from "react-native";
import { PRESETS, UserStatus } from "@/lib/userStatus";
import { useTheme } from "@/lib/theme";

interface Props {
  visible: boolean;
  onDone: (status: UserStatus) => void;
}

export function CheckInModal({ visible, onDone }: Props) {
  const { palette } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");

  function confirm() {
    if (selected === null) return;
    const preset = PRESETS[selected];
    onDone({ emoji: preset.emoji, label: preset.label, note: note.trim(), timestamp: Date.now() });
    setSelected(null);
    setNote("");
  }

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: palette.bg }]}
      >
        <Text style={[styles.aiLabel, { color: palette.accent }]}>Bạn của Kem</Text>
        <Text style={[styles.question, { color: palette.fg }]}>"Kem đang thế nào?"</Text>

        <View style={styles.grid}>
          {PRESETS.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => setSelected(i)}
              style={[
                styles.card,
                { backgroundColor: palette.surface, borderColor: palette.border },
                selected === i && { borderColor: palette.accent, backgroundColor: palette.surface },
              ]}
            >
              <Text style={styles.cardEmoji}>{p.emoji}</Text>
              <Text style={[styles.cardLabel, { color: palette.fg }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="thêm gì không? (không bắt buộc)"
          placeholderTextColor="#555"
          style={[styles.noteInput, { color: palette.fg, backgroundColor: palette.surface, borderColor: palette.border }]}
        />

        <Pressable
          onPress={confirm}
          disabled={selected === null}
          style={[
            styles.button,
            { backgroundColor: selected === null ? "#333" : palette.accent },
          ]}
        >
          <Text style={styles.buttonText}>Vào thôi →</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  aiLabel:     { fontSize: 12, marginBottom: 4, letterSpacing: 0.5 },
  question:    { fontSize: 20, fontWeight: "700", marginBottom: 24, textAlign: "center" },
  grid:        { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 20 },
  card:        { width: 90, alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1.5 },
  cardEmoji:   { fontSize: 28, marginBottom: 4 },
  cardLabel:   { fontSize: 11 },
  noteInput:   { width: "100%", borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13 },
  button:      { width: "100%", padding: 14, borderRadius: 8, alignItems: "center" },
  buttonText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
});
