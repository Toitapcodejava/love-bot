import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import { ThemeProvider, useTheme } from "@/lib/theme";
import { bindThemeSetter } from "@/lib/toolExecutor";
import { registerForPush } from "@/lib/notifications";
import { useUserStatus, isStale, UserStatus } from "@/lib/userStatus";
import { CheckInModal } from "@/components/CheckInModal";

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

  useEffect(() => {
    if (loaded && isStale(status)) {
      setShowCheckIn(true);
    }
  }, [loaded, status]);

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
