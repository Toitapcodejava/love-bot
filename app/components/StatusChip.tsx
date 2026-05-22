import { useState } from "react";
import {
  View, Text, Pressable, Modal, StyleSheet,
  KeyboardAvoidingView, Platform, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { PRESETS, UserStatus } from "@/lib/userStatus";
import { useTheme } from "@/lib/theme";

const NEGATIVE_LABELS = new Set(["Tức", "Buồn", "Lo lắng", "Trống", "Kiệt sức"]);

interface Props {
  status: UserStatus;
  onUpdate: (s: UserStatus) => void;
}

export function StatusChip({ status, onUpdate }: Props) {
  const { palette } = useTheme();
  const router = useRouter();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const isNegative = NEGATIVE_LABELS.has(status.label);

  function openPicker() {
    const idx = PRESETS.findIndex((p) => p.label === status.label);
    setSelected(idx >= 0 ? idx : null);
    setNote(status.note ?? "");
    setPickerVisible(true);
  }

  function confirmPicker() {
    if (selected === null) return;
    const p = PRESETS[selected];
    onUpdate({ emoji: p.emoji, label: p.label, note: note.trim(), timestamp: Date.now() });
    setPickerVisible(false);
  }

  return (
    <>
      <View style={styles.row}>
        <Pressable
          onPress={openPicker}
          style={[styles.chip, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={styles.emoji}>{status.emoji}</Text>
          <Text style={[styles.label, { color: palette.fg }]}>{status.label}</Text>
          <Text style={[styles.edit, { color: "#555" }]}>✎</Text>
        </Pressable>

        {isNegative && (
          <Pressable
            onPress={() => router.push("/rage")}
            style={styles.rageChip}
          >
            <Text style={styles.rageText}>🔥 Đập ngay</Text>
          </Pressable>
        )}
      </View>

      <Modal visible={pickerVisible} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.sheet, { backgroundColor: palette.surface }]}
        >
          <View style={styles.grid}>
            {PRESETS.map((p, i) => (
              <Pressable
                key={p.label}
                onPress={() => setSelected(i)}
                style={[
                  styles.card,
                  { borderColor: palette.border, backgroundColor: palette.bg },
                  selected === i && { borderColor: palette.accent },
                ]}
              >
                <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
                <Text style={[styles.cardLabel, { color: palette.fg }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="thêm gì không?"
            placeholderTextColor="#555"
            style={[styles.noteInput, { color: palette.fg, borderColor: palette.border }]}
          />
          <Pressable
            onPress={confirmPicker}
            disabled={selected === null}
            style={[styles.confirmBtn, { backgroundColor: selected === null ? "#333" : palette.accent }]}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Xong</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 4 },
  chip:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  emoji:      { fontSize: 14 },
  label:      { fontSize: 11 },
  edit:       { fontSize: 11 },
  rageChip:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "#ff4444", backgroundColor: "#2a1a1a" },
  rageText:   { color: "#ff6666", fontSize: 11 },
  backdrop:   { flex: 1 },
  sheet:      { padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  grid:       { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 12 },
  card:       { width: 80, alignItems: "center", padding: 8, borderRadius: 10, borderWidth: 1.5 },
  cardLabel:  { fontSize: 10, marginTop: 2 },
  noteInput:  { borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 12, marginBottom: 10 },
  confirmBtn: { padding: 12, borderRadius: 8, alignItems: "center" },
});
