import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}