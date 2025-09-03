import { stackServerApp } from "@/lib/utils/stack";
import { StackProvider, StackTheme } from "@stackframe/stack";
import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import clsx from "clsx";
import "./globals.css";

export const metadata: Metadata = {
  title: "cmux - Orchestrate AI coding agents in parallel",
  description:
    "cmux spawns Claude Code, Codex, Gemini CLI, Amp, Opencode, and other coding agent CLIs in parallel across multiple tasks. For each run, cmux spawns an isolated VS Code instance via Docker with the git diff UI and terminal.",
  openGraph: {
    title: "cmux - Orchestrate AI coding agents in parallel",
    description:
      "Run multiple AI coding agents simultaneously with isolated VS Code instances",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "cmux - Orchestrate AI coding agents in parallel",
    description:
      "Run multiple AI coding agents simultaneously with isolated VS Code instances",
  },
};

const jetBrainsMono = localFont({
  src: [
    {
      path: "../public/fonts/JetBrainsMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/JetBrainsMono-Regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/JetBrainsMono-Bold.woff2",
      weight: "bold",
      style: "normal",
    },
    {
      path: "../public/fonts/JetBrainsMono-Bold.woff",
      weight: "bold",
      style: "normal",
    },
    {
      path: "../public/fonts/JetBrainsMono-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/JetBrainsMono-Italic.woff",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/JetBrainsMono-BoldItalic.woff2",
      weight: "bold",
      style: "italic",
    },
    {
      path: "../public/fonts/JetBrainsMono-BoldItalic.woff",
      weight: "bold",
      style: "italic",
    },
  ],
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
