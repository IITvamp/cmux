import { ThemeProvider } from "@/components/theme/theme-provider";
import { SocketProvider } from "@/contexts/socket/socket-provider";
import { ConfigProvider, theme, type ThemeConfig } from "antd";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { TerminalContextProvider } from "./contexts/TerminalContextProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          setIsDarkMode(root.classList.contains("dark"));
        }
      });
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    setIsDarkMode(root.classList.contains("dark"));

    return () => observer.disconnect();
  }, []);

  const antdTheme: ThemeConfig = useMemo(() => {
    return {
      algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
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
    <ThemeProvider>
      <ConfigProvider theme={antdTheme}>
        {/* <ConvexProvider client={convex}>
          <QueryClientProvider client={queryClient}> */}
        <SocketProvider>
          <TerminalContextProvider>{children}</TerminalContextProvider>
        </SocketProvider>
        {/* </QueryClientProvider>
        </ConvexProvider> */}
      </ConfigProvider>
    </ThemeProvider>
  );
}
