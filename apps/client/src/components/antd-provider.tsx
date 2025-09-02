import {
  ConfigProvider as AntdConfigProvider,
  theme as antdTheme,
  type ThemeConfig,
} from "antd";
import { useMemo } from "react";
import { useTheme } from "./theme/use-theme";

export function AntdProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const themeConfig: ThemeConfig = useMemo(() => {
    return {
      algorithm: isDarkMode
        ? antdTheme.darkAlgorithm
        : antdTheme.defaultAlgorithm,
      components: {
        Select: {
          motion: true,
        },
        Dropdown: {
          motion: true,
        },
      },
    };
  }, [isDarkMode]);
  return (
    <AntdConfigProvider theme={themeConfig}>{children}</AntdConfigProvider>
  );
}
