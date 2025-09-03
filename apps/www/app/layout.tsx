import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "@cmux/client/src/index.css";
import "@cmux/client/src/antd-overrides.css";

export const metadata: Metadata = {
  title: "cmux - Orchestrate AI coding agents in parallel",
  description: "cmux spawns Claude Code, Codex, Gemini CLI, Amp, Opencode, and other coding agent CLIs in parallel across multiple tasks. For each run, cmux spawns an isolated VS Code instance via Docker with the git diff UI and terminal.",
  openGraph: {
    title: "cmux - Orchestrate AI coding agents in parallel",
    description: "Run multiple AI coding agents simultaneously with isolated VS Code instances",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "cmux - Orchestrate AI coding agents in parallel",
    description: "Run multiple AI coding agents simultaneously with isolated VS Code instances",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="antialiased bg-background text-foreground"
        style={{
          fontFamily:
            '"JetBrains Mono","SFMono-Regular","Menlo","Consolas","ui-monospace","Monaco","Courier New",monospace',
        }}
      >
        {children}
      </body>
    </html>
  );
}
