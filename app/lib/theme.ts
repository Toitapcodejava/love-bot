import React, { createContext, useContext, useState } from "react";

export type ThemeMode = "chaos" | "dark" | "calm" | "red_alert";

const PALETTES: Record<ThemeMode, { bg: string; fg: string; accent: string }> = {
  chaos:     { bg: "#0a0a0a", fg: "#ffffff", accent: "#ff2d55" },
  dark:      { bg: "#000000", fg: "#e5e5e5", accent: "#888888" },
  calm:      { bg: "#1a1a2e", fg: "#eaeaea", accent: "#7aa2f7" },
  red_alert: { bg: "#1a0000", fg: "#ffe5e5", accent: "#ff0000" },
};

const Ctx = createContext({ mode: "dark" as ThemeMode, set: (_:ThemeMode)=>{}, palette: PALETTES.dark });

export function ThemeProvider({ children }: any) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  return <Ctx.Provider value={{ mode, set: setMode, palette: PALETTES[mode] }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
