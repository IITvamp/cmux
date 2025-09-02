import { ThemeProvider } from "@/components/theme/theme-provider";
import { HeroUIProvider } from "@heroui/react";
import { StackProvider, StackTheme } from "@stackframe/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, Suspense } from "react";
import { AntdProvider } from "./components/antd-provider";
import { stackClientApp } from "./lib/stack";
import { queryClient } from "./query-client";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <StackTheme>
        <Suspense fallback={<div>Loading stack...</div>}>
          <StackProvider app={stackClientApp}>
            <QueryClientProvider client={queryClient}>
              <HeroUIProvider>
                <AntdProvider>{children}</AntdProvider>
              </HeroUIProvider>
            </QueryClientProvider>
          </StackProvider>
        </Suspense>
      </StackTheme>
    </ThemeProvider>
  );
}
