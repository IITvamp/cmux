"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import CmuxLogo from "@/components/logo/cmux-logo";
import { TutorialSidebar, type TutorialSection } from "./TutorialSidebar";

type TutorialLayoutProps = {
  children: ReactNode;
  sections: TutorialSection[];
};

export function TutorialLayout({ children, sections }: TutorialLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/80">
        <div className="flex h-14 items-center px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-4 inline-flex lg:hidden"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
          <Link href="/" className="flex items-center gap-2">
            <CmuxLogo height={32} showWordmark />
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/"
              className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              Home
            </Link>
            <a
              href="https://github.com/manaflow-ai/cmux"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-64 xl:w-72 sticky top-14 h-[calc(100vh-3.5rem)]">
          <TutorialSidebar sections={sections} />
        </aside>

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <aside className="fixed inset-0 top-14 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative w-64 h-full bg-neutral-950">
              <TutorialSidebar sections={sections} />
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="container max-w-4xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
            {children}
          </div>
        </main>

        {/* Table of Contents - Right Sidebar (Optional for future) */}
        <aside className="hidden xl:block w-64 sticky top-14 h-[calc(100vh-3.5rem)]">
          <div className="px-4 py-6">
            <div className="text-sm font-semibold text-neutral-500 mb-4">
              ON THIS PAGE
            </div>
            {/* TOC items will be added here via client-side extraction */}
          </div>
        </aside>
      </div>
    </div>
  );
}
