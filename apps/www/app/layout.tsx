import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "../lib/utils/stack";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StackTheme>
          <StackProvider app={stackServerApp}>
            {children}
          </StackProvider>
        </StackTheme>
      </body>
    </html>
  );
}

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
