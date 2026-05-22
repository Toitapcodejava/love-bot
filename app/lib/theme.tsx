import React, { createContext, useContext, useState } from "react";

export type ThemeMode = "chaos" | "dark" | "calm" | "red_alert";

const PALETTES: Record<ThemeMode, {
  bg: string; fg: string; accent: string; accent2: string;
  surface: string; border: string;
}> = {
  chaos:     { bg: "#0a0a0a", fg: "#ffffff", accent: "#ff2d55", accent2: "#ff6b6b", surface: "#222", border: "#333" },
  dark:      { bg: "#0d0d1a", fg: "#eaeaea", accent: "#7aa2f7", accent2: "#bb9af7", surface: "#1a1a2e", border: "#2a2a3e" },
  calm:      { bg: "#1a1a2e", fg: "#eaeaea", accent: "#7aa2f7", accent2: "#bb9af7", surface: "#16213e", border: "#2a2a4e" },
  red_alert: { bg: "#1a0000", fg: "#ffe5e5", accent: "#ff0000", accent2: "#ff4444", surface: "#2a0000", border: "#3a0000" },
};

const Ctx = createContext({
  mode: "dark" as ThemeMode,
  set: (_: ThemeMode) => {},
  palette: PALETTES.dark,
});

export function ThemeProvider({ children }: any) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  return (
    <Ctx.Provider value={{ mode, set: setMode, palette: PALETTES[mode] }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
