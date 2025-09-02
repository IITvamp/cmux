"use client";

import { ClientIcon } from "@/components/client-icon";
import CmuxLogo from "@/components/logo/cmux-logo";
import {
  Check,
  Cloud,
  Copy,
  GitBranch,
  Github,
  GitPullRequest,
  Star,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function LandingPage() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(text);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground overflow-y-auto">
      {/* Announcement bar */}
      <div className="w-full bg-blue-300 px-3 py-1 text-center font-medium text-black">
        <span>
          cmux is{" "}
          <a
            href="https://github.com/manaflow-ai/cmux"
            target="_blank"
            rel="noopener noreferrer"
            className="text-black underline decoration-blue-600 decoration-dotted underline-offset-4 hover:decoration-solid"
          >
            open source on GitHub
          </a>
          .
        </span>{" "}
        <span className="whitespace-nowrap ml-2">
          <a
            href="#requirements"
            className="whitespace-nowrap bg-black px-2 py-0.5 rounded-sm font-semibold text-blue-300 hover:text-blue-200"
          >
            See requirements
          </a>
        </span>
      </div>

      {/* Header */}
      <header className="mb-6 bg-neutral-950/80 backdrop-blur top-0 z-40 border-b border-neutral-900">
        <div className="container max-w-5xl mx-auto px-2 sm:px-3 py-2.5">
          <div className="grid w-full grid-cols-[auto_1fr] grid-rows-1 items-center gap-2">
            <Link
              aria-label="Go to homepage"
              className="col-start-1 col-end-2 inline-flex items-center"
              href="/"
            >
              <CmuxLogo height={40} label="cmux" showWordmark />
            </Link>
            <div className="col-start-2 col-end-3 flex items-center justify-end gap-2 sm:gap-3">
              <nav aria-label="Main" className="hidden md:flex items-center">
                <ul className="flex flex-wrap items-center gap-x-2">
                  <li>
                    <a
                      className="font-semibold text-white hover:text-blue-400 transition"
                      href="#about"
                    >
                      About
                    </a>
                  </li>
                  <li className="text-neutral-700 px-1" role="presentation">
                    |
                  </li>
                  <li>
                    <a
                      className="font-semibold text-white hover:text-blue-400 transition"
                      href="#features"
                    >
                      Features
                    </a>
                  </li>
                  <li className="text-neutral-700 px-1" role="presentation">
                    |
                  </li>
                  <li>
                    <a
                      className="font-semibold text-white hover:text-blue-400 transition"
                      href="#requirements"
                    >
                      Requirements
                    </a>
                  </li>
                  <li className="text-neutral-700 px-1" role="presentation">
                    |
                  </li>
                  <li>
                    <a
                      href="https://cal.com/team/manaflow/meeting"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center bg-blue-500 px-3 text-sm font-semibold text-white hover:bg-blue-400"
                    >
                      Book a meeting
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </header>

      <section className="pt-10 pb-8">
        <div className="container max-w-5xl mx-auto px-3 sm:px-5">
          <div className="grid grid-cols-[4px_1fr] gap-6">
            <div className="bg-blue-500 rounded-sm" aria-hidden="true"></div>
            <div>
              <h1 className="text-4xl sm:text-4xl md:text-4xl font-semibold mb-6">
                Orchestrate AI coding agents in parallel
              </h1>

              <p className="text-lg text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
                cmux spawns Claude Code, Codex CLI, Gemini CLI, Amp, Opencode, and other coding
                agent CLIs in parallel across multiple tasks with isolated environments and
                automatic verification. Each run creates a separate VS Code instance with a git
                diff UI and active terminal, making it crystal clear what changed and why.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2 text-neutral-500">
                  <ClientIcon icon={Terminal} className="h-4 w-4" aria-hidden="true" />
                  <span className="text-sm">Run locally with Bun or NPX</span>
                </div>
                <div className="hidden sm:block h-4 w-px bg-neutral-300 dark:bg-neutral-700" />
                <div className="flex items-center gap-2 text-neutral-500">
                  <ClientIcon icon={GitPullRequest} className="h-4 w-4" aria-hidden="true" />
                  <span className="text-sm">Review diffs per-task</span>
                </div>
                <div className="hidden sm:block h-4 w-px bg-neutral-300 dark:bg-neutral-700" />
                <div className="flex items-center gap-2 text-neutral-500">
                  <ClientIcon icon={Zap} className="h-4 w-4" aria-hidden="true" />
                  <span className="text-sm">Parallel execution</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 font-mono text-sm flex items-center gap-3">
                  <span className="text-white">$ bunx cmux</span>
                  <button
                    onClick={() => copyToClipboard("bunx cmux")}
                    className="text-neutral-500 hover:text-white transition-colors"
                  >
                    {copiedCommand === "bunx cmux" ? (
                      <ClientIcon icon={Check} className="h-4 w-4 text-green-400" aria-hidden />
                    ) : (
                      <ClientIcon icon={Copy} className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 font-mono text-sm flex items-center gap-3">
                  <span className="text-white">$ npx cmux</span>
                  <button
                    onClick={() => copyToClipboard("npx cmux")}
                    className="text-neutral-500 hover:text-white transition-colors"
                  >
                    {copiedCommand === "npx cmux" ? (
                      <ClientIcon icon={Check} className="h-4 w-4 text-green-400" aria-hidden />
                    ) : (
                      <ClientIcon icon={Copy} className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* First demo image combined with hero */}
          <div className="mt-16 mb-8 relative overflow-hidden rounded-lg">
            <Image
              src="/cmux-demo-2.png"
              alt="cmux dashboard showing parallel AI agent execution"
              width={1200}
              height={800}
              className="w-full h-auto"
              priority
            />
          </div>
          <div className="flex justify-center">
            <div className="w-48 h-px bg-neutral-200 dark:bg-neutral-800"></div>
          </div>
        </div>
      </section>

      <section id="about" className="pt-8 px-4 sm:px-6 lg:px-12">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8">
            Rethinking the developer interface
          </h2>

          <div className="space-y-8 text-neutral-400 mb-12">
            <div className="space-y-2">
              <p>
                <span className="text-white font-semibold">The interface is the bottleneck.</span>{" "}
                We&apos;ve spent years making AI agents better at coding, but almost no time making it
                easier to verify their work. The result? Developers spend 80% of their time
                reviewing and 20% prompting.
              </p>
              <blockquote className="border-l-2 border-neutral-800 pl-4 text-neutral-300">
                <p>
                  Running multiple agents at once sounds powerful until it turns into chaos: 3-4
                  terminals, each on a different task, and you&apos;re asking, “Which one is on auth?
                  Did the database refactor finish?” You end up bouncing between windows, running
                  git diff, and piecing together what changed where.
                </p>
              </blockquote>
            </div>
            <div className="space-y-2">
              <p>
                <span className="text-white font-semibold">Isolation enables scale.</span>{" "}
                When each agent runs in its own container with its own VS Code instance, you
                eliminate the confusion of shared state. Every diff is clean. Every terminal output
                is separate. Every verification is independent.
              </p>
              <blockquote className="border-l-2 border-neutral-800 pl-4 text-neutral-300">
                <p>
                  The issue isn&apos;t that agents aren&apos;t good — they&apos;re getting scary good. It&apos;s that
                  our tools were designed for a different era. VS Code was built for writing code,
                  not reviewing five parallel streams of AI-generated changes. Terminals expect
                  sequential commands, not a fleet of autonomous workers.
                </p>
              </blockquote>
            </div>
            <div className="space-y-2">
              <p>
                <span className="text-white font-semibold">Verification is non-negotiable.</span>{" "}
                Code diffs are just the start. We need to see the running application, the test
                results, the performance metrics—all in real-time, for every agent, without
                switching contexts.
              </p>
              <blockquote className="border-l-2 border-neutral-800 pl-4 text-neutral-300">
                <p>
                  cmux solves this by giving each agent its own world: separate Docker container,
                  separate VS Code, separate git state. VS Code opens with the git diff already
                  showing. Every change is isolated to its task, so you can see exactly what each
                  agent did — immediately — without losing context. That&apos;s what makes running 10+
                  agents actually workable.
                </p>
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-center py-8">
        <div className="w-48 h-px bg-neutral-200 dark:bg-neutral-800"></div>
      </div>

      <section id="features" className="pt-8 px-4 sm:px-6 lg:px-12">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-8 text-center">How cmux works today</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={GitBranch} className="h-4 w-4 text-neutral-500" aria-hidden />
                  Separate VS Code IDE instances
                </h3>
                <p className="text-sm text-neutral-400">
                  Each agent runs in its own VS Code instance. You can open them in your IDE of
                  choice, locally or remotely.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={Users} className="h-4 w-4 text-neutral-500" aria-hidden />
                  Multiple agent support
                </h3>
                <p className="text-sm text-neutral-400">
                  Claude Code, Codex, Gemini CLI, Amp, Opencode, and other coding agent CLIs.
                  Particularly useful to run agents together and find the best one for the task.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={Star} className="h-4 w-4 text-neutral-500" aria-hidden />
                  Git extension UI
                </h3>
                <p className="text-sm text-neutral-400">
                  On mount, VS Code opens the git extension&apos;s diff UI. Review changes without
                  context switching.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={Cloud} className="h-4 w-4 text-neutral-500" aria-hidden />
                  Sandbox environment preview
                </h3>
                <p className="text-sm text-neutral-400">
                  Spin up isolated sandboxes to preview your changes safely. cmux uses fast cloud
                  sandboxes or Docker locally.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={Zap} className="h-4 w-4 text-neutral-500" aria-hidden />
                  Parallel task orchestration
                </h3>
                <p className="text-sm text-neutral-400">
                  Launch multiple agents simultaneously, each working on a separate task with clear
                  isolation.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={Github} className="h-4 w-4 text-neutral-500" aria-hidden />
                  GitHub-ready workflows
                </h3>
                <p className="text-sm text-neutral-400">
                  Easily integrate into your existing GitHub flow for PRs and code reviews.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-center py-8">
        <div className="w-48 h-px bg-neutral-200 dark:bg-neutral-800"></div>
      </div>

      <section id="requirements" className="py-8 px-4 sm:px-6 lg:px-12">
        <div className="container max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-4">Requirements</h2>
          <p className="text-neutral-400 mb-8">
            cmux runs locally on your machine. You&apos;ll need:
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-3">
              Docker installed
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-3">
              Node.js 20+ or Bun 1.1.25+
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-3">
              Access to cloud or local Docker
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-center py-8">
        <div className="w-48 h-px bg-neutral-200 dark:bg-neutral-800"></div>
      </div>

      <section className="py-8 px-4 sm:px-6 lg:px-12">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-4 text-center">Get started</h2>
          <div className="flex flex-col items-center gap-4">
            <a
              href="https://github.com/manaflow-ai/cmux"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-neutral-200 rounded-lg font-medium transition-colors"
            >
              <ClientIcon icon={Github} className="h-5 w-5" aria-hidden />
              <span>View on GitHub</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
