import { useContext } from "react";
import { ThemeProviderContext, type Theme, type ResolvedTheme } from "./theme-context";

type UseThemeReturn = {
  // Always resolved to "light" | "dark"
  theme: ResolvedTheme;
  // For now, expose the raw selection under `resolvedTheme` name
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
};

export const useTheme = (): UseThemeReturn => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  const { resolvedTheme, theme, setTheme } = context;
  return { theme: resolvedTheme, resolvedTheme: theme, setTheme };
};
