import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useCallback } from "react";

export type UserStatus = {
  emoji: string;
  label: string;
  note: string;
  timestamp: number;
};

export type Preset = UserStatus & { bossId: string | null };

export const PRESETS: Preset[] = [
  { emoji: "😤", label: "Tức",      note: "", timestamp: 0, bossId: "anger"     },
  { emoji: "😢", label: "Buồn",     note: "", timestamp: 0, bossId: "sadness"   },
  { emoji: "😰", label: "Lo lắng",  note: "", timestamp: 0, bossId: "anxiety"   },
  { emoji: "😶", label: "Trống",    note: "", timestamp: 0, bossId: "numbness"  },
  { emoji: "🫠", label: "Kiệt sức", note: "", timestamp: 0, bossId: "exhaustion"},
  { emoji: "😌", label: "Ổn hơn",   note: "", timestamp: 0, bossId: null        },
];

const KEY = "USER_STATUS";
const STALE_MS = 4 * 60 * 60 * 1000; // 4 hours

export function isStale(status: UserStatus | null): boolean {
  if (!status) return true;
  return Date.now() - status.timestamp > STALE_MS;
}

export function useUserStatus() {
  const [status, setStatusState] = useState<UserStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) setStatusState(JSON.parse(raw));
      setLoaded(true);
    });
  }, []);

  const setStatus = useCallback(async (s: UserStatus) => {
    const next = { ...s, timestamp: Date.now() };
    setStatusState(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const clearStatus = useCallback(async () => {
    setStatusState(null);
    await AsyncStorage.removeItem(KEY);
  }, []);

  return { status, setStatus, clearStatus, loaded };
}

export function statusContext(status: UserStatus | null): string | undefined {
  if (!status) return undefined;
  const note = status.note ? ` — "${status.note}"` : "";
  return `[Trạng thái hiện tại của Kem: ${status.emoji} ${status.label}${note}]`;
}
