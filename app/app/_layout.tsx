import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import "react-native-reanimated";

import { ThemeProvider, useTheme } from "@/lib/theme";
import { bindThemeSetter } from "@/lib/toolExecutor";
import { registerForPush } from "@/lib/notifications";
import { useUserStatus, isStale, UserStatus } from "@/lib/userStatus";
import { CheckInModal } from "@/components/CheckInModal";
import { QuoteModal } from "@/components/QuoteModal";
import { getJSON } from "@/lib/api";
import { storage } from "@/lib/storage";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = { initialRouteName: "(tabs)" };

SplashScreen.preventAutoHideAsync();

function WireTools() {
  const { set } = useTheme();
  useEffect(() => { bindThemeSetter(set); }, [set]);
  useEffect(() => { registerForPush(); }, []);
  return null;
}

function AppShell() {
  const { status, setStatus, loaded } = useUserStatus();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const pendingCheckIn = useRef(false);

  useEffect(() => {
    if (!loaded) return;

    async function initQuote() {
      try {
        const base = await storage.getBase();
        if (!base) return;

        // Đọc persona_mode trực tiếp qua SecureStore
        const { default: SecureStore } = await import("expo-secure-store");
        const mode = (await SecureStore.getItemAsync("PERSONA_MODE")) ?? "tsundere";

        if (mode !== "silent_beauty") {
          if (isStale(status)) setShowCheckIn(true);
          return;
        }

        // Hiện modal ngay (loading state) rồi fetch
        setShowQuote(true);
        pendingCheckIn.current = isStale(status);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
          const data = await getJSON("/api/quotes/daily");
          setQuoteText(data.quote ?? "");
        } catch {
          // timeout hoặc lỗi → đóng modal luôn
          setShowQuote(false);
          if (pendingCheckIn.current) setShowCheckIn(true);
          pendingCheckIn.current = false;
        } finally {
          clearTimeout(timeout);
        }
      } catch {
        if (isStale(status)) setShowCheckIn(true);
      }
    }

    initQuote();
  }, [loaded]);

  function handleQuoteDone() {
    setShowQuote(false);
    setQuoteText("");
    if (pendingCheckIn.current) {
      setShowCheckIn(true);
      pendingCheckIn.current = false;
    }
  }

  async function handleCheckInDone(s: UserStatus) {
    await setStatus(s);
    setShowCheckIn(false);
  }

  return (
    <>
      <WireTools />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        <Stack.Screen name="vent" options={{ headerShown: false }} />
      </Stack>
      <QuoteModal visible={showQuote} quote={quoteText} onDismiss={handleQuoteDone} />
      <CheckInModal visible={showCheckIn} onDone={handleCheckInDone} />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
