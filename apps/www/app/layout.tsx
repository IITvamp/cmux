import { stackServerApp } from "@/lib/utils/stack";
import { StackProvider, StackTheme } from "@stackframe/stack";
import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import clsx from "clsx";
import "./globals.css";

export const metadata: Metadata = {
  title: "cmux — AI workflow builder for businesses",
  description:
    "Build, run, and verify AI workflows for software teams. cmux spawns Claude Code, Codex, Gemini CLI, Amp, Opencode, and other coding agent CLIs in parallel with isolated VS Code instances for safe review.",
  openGraph: {
    title: "cmux — AI workflow builder for businesses",
    description:
      "Build, run, and verify AI workflows with isolated VS Code instances for safe review.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "cmux — AI workflow builder for businesses",
    description:
      "Build, run, and verify AI workflows with isolated VS Code instances for safe review.",
  },
};

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-jetbrains-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={clsx("dark", jetBrainsMono.className)}>
      <body
        className="antialiased bg-background text-foreground"
        style={{
          fontFamily:
            '"JetBrains Mono","SFMono-Regular","Menlo","Consolas","ui-monospace","Monaco","Courier New",monospace',
        }}
      >
        <StackTheme>
          <StackProvider app={stackServerApp}>{children}</StackProvider>
        </StackTheme>
      </body>
    </html>
  );
}
