import { stackServerApp } from "@/lib/utils/stack";
import { StackProvider, StackTheme } from "@stackframe/stack";
import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={clsx("dark")}> 
      <body
        className="antialiased bg-background text-foreground"
      >
        <StackTheme>
          <StackProvider app={stackServerApp}>{children}</StackProvider>
        </StackTheme>
      </body>
    </html>
  );
}
