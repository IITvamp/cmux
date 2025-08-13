"use client";

import { ClientIcon } from "@/components/client-icon";
import {
  ArrowRight,
  Check,
  Cloud,
  Copy,
  FileText,
  GitBranch,
  Github,
  Star,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export default function LandingPage() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(text);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto">
      <nav className="sticky top-0 w-full z-50 bg-black/90 backdrop-blur-sm border-b border-neutral-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <ClientIcon
                icon={Terminal}
                className="h-5 w-5"
                aria-hidden="true"
              />
              <span className="text-lg font-mono">cmux</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/manaflow-ai/cmux"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                <ClientIcon
                  icon={Github}
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                <span>GitHub</span>
              </a>
              <a
                href="https://cal.com/team/manaflow/meeting"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="container my-6 max-w-7xl px-3 sm:px-5 lg:px-12 mx-auto">
        <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
          <h1 className="font-bold mb-6 relative">
            <Terminal className="absolute -left-10 text-purple-500" />
            The interface for running coding agents in parallel
          </h1>

          <p>
            cmux lets you run Claude Code, Codex CLI, Cursor CLI, Gemini CLI,
            Amp, Opencode, and other coding agent CLIs in parallel across
            multiple tasks. Each agent runs in its own Docker container,
            launching VS Code with a Git diff UI and a terminal for its CLI.
          </p>
          {/* Run Claude Code, Codex CLI, Cursor CLI, Gemini CLI, Amp, Opencode,
            and other coding agent CLIs in parallel across multiple tasks */}

          <div className="max-w-4xl mx-auto hidden">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 font-mono">
              Orchestrate AI coding agents in parallel
            </h1>

            <p className="text-lg mb-8 leading-relaxed">
              cmux spawns Claude Code, Codex, Gemini CLI, Amp, Opencode, and
              other coding agent CLIs in parallel across multiple tasks. For
              each run, cmux spawns an isolated VS Code instance via Docker with
              the git diff UI and terminal.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12 max-w-lg">
              <div className="bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 font-mono text-sm flex items-center gap-3">
                <span className="text-white">$ bunx cmux</span>
                <button
                  onClick={() => copyToClipboard("bunx cmux")}
                  className="text-neutral-500 hover:text-white transition-colors"
                >
                  {copiedCommand === "bunx cmux" ? (
                    <ClientIcon
                      icon={Check}
                      className="h-4 w-4 text-green-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <ClientIcon
                      icon={Copy}
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
              <div className="bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 font-mono text-sm flex items-center gap-3">
                <span className="text-white">$ npx cmux</span>
                <button
                  onClick={() => copyToClipboard("npx cmux")}
                  className="text-neutral-500 hover:text-white transition-colors"
                >
                  {copiedCommand === "npx cmux" ? (
                    <ClientIcon
                      icon={Check}
                      className="h-4 w-4 text-green-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <ClientIcon
                      icon={Copy}
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <a
                href="https://github.com/manaflow-ai/cmux"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-neutral-200 rounded-lg font-medium transition-colors"
              >
                <ClientIcon
                  icon={Github}
                  className="h-5 w-5"
                  aria-hidden="true"
                />
                <span>View on GitHub</span>
              </a>
              <a
                href="https://cal.com/team/manaflow/meeting"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-800 hover:bg-neutral-900 transition-colors"
              >
                <span>Contact us</span>
                <ClientIcon
                  icon={ArrowRight}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>

          <div className="lg:-mx-20 2xl:-mx-20 pt-10 pb-20">
            <Image
              src="/cmux-demo.png"
              alt="cmux dashboard showing parallel AI agent execution"
              width={1200}
              height={800}
              className="w-full h-auto"
              priority
            />
          </div>

          <div>
            <h2 className="underline font-bold underline-offset-4 pb-6">
              Human verification is the bottleneck
            </h2>
            <p className="mb-6">
              You've probably tried running multiple Claude instances at once.
              Maybe you had 3-4 terminals open, each with a different agent
              working on a different part of your codebase. It starts fine, but
              quickly becomes chaos. Which terminal is working on the auth
              system? Did the one refactoring the database actually finish?
              You're constantly switching between windows, running git diff,
              trying to piece together what changed where.
            </p>
            <p className="mb-6">
              The problem isn't the agents—they're getting scary good. The
              problem is that we're using developer tools built for a different
              era. VS Code was designed for writing code, not for reviewing 5
              parallel streams of AI-generated changes. Your terminal was built
              for sequential commands, not for managing a fleet of autonomous
              agents.
            </p>
          </div>

          <div>
            <h2 className="underline font-bold underline-offset-4 pb-6">
              A new interface for verification
            </h2>
          </div>
        </section>

        <section className="pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              <div className="lg:-mx-20 2xl:-mx-40">
                <Image
                  src="/cmux-demo.png"
                  alt="cmux dashboard showing parallel AI agent execution"
                  width={1200}
                  height={800}
                  className="w-full h-auto"
                  priority
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-xs text-neutral-500 font-mono ml-2">
                      terminal
                    </span>
                  </div>
                  <div className="p-4 font-mono text-sm space-y-2">
                    <div className="text-neutral-500">$ ./scripts/dev.sh</div>
                    <div className="text-green-400">
                      ✓ Docker containers ready
                    </div>
                    <div className="text-green-400">
                      ✓ VS Code servers initialized
                    </div>
                    <div className="text-green-400">
                      ✓ Dashboard running on :3000
                    </div>
                    <div className="text-neutral-400 mt-4">
                      Ready to spawn AI agents...
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-xs text-neutral-500 font-mono ml-2">
                      localhost:3000
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          Active Tasks
                        </span>
                        <span className="text-xs text-neutral-500">
                          3 running
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="bg-neutral-900 rounded p-2 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span>Refactor auth module</span>
                          </div>
                          <div className="text-neutral-500 ml-4">
                            Claude Code • port 8001
                          </div>
                        </div>
                        <div className="bg-neutral-900 rounded p-2 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span>Add test coverage</span>
                          </div>
                          <div className="text-neutral-500 ml-4">
                            Codex • port 8002
                          </div>
                        </div>
                        <div className="bg-neutral-900 rounded p-2 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Database migration</span>
                          </div>
                          <div className="text-neutral-500 ml-4">
                            Gemini CLI • complete
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Parallel execution
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-neutral-900 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ClientIcon
                          icon={Terminal}
                          className="h-4 w-4 text-blue-500"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-mono">Claude Code</span>
                      </div>
                      <div className="text-xs text-neutral-500 space-y-1">
                        <div>Task: auth module</div>
                        <div>
                          VS Code:{" "}
                          <span className="text-yellow-400">port 8001</span>
                        </div>
                        <div>Git: 3 files changed</div>
                      </div>
                    </div>
                    <div className="bg-neutral-900 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ClientIcon
                          icon={Terminal}
                          className="h-4 w-4 text-purple-500"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-mono">Codex</span>
                      </div>
                      <div className="text-xs text-neutral-500 space-y-1">
                        <div>Task: test coverage</div>
                        <div>
                          VS Code:{" "}
                          <span className="text-green-400">port 8002</span>
                        </div>
                        <div>Git: tests added</div>
                      </div>
                    </div>
                    <div className="bg-neutral-900 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ClientIcon
                          icon={Terminal}
                          className="h-4 w-4 text-green-500"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-mono">Gemini CLI</span>
                      </div>
                      <div className="text-xs text-neutral-500 space-y-1">
                        <div>Task: API endpoints</div>
                        <div>
                          VS Code:{" "}
                          <span className="text-green-400">port 8003</span>
                        </div>
                        <div>Git: ready to commit</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-900 rounded-lg p-3">
                    <div className="flex justify-between text-xs text-neutral-500 mb-2">
                      <span>2 of 3 tasks done</span>
                      <span>~4 min left</span>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: "67%" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-center py-8">
          <div className="w-48 h-px bg-neutral-800"></div>
        </div>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              Rethinking the developer interface
            </h2>
            <div className="space-y-4 text-neutral-400 mb-12">
              <p>
                <span className="text-white font-semibold">
                  The interface is the bottleneck.
                </span>{" "}
                We've spent years making AI agents better at coding, but almost
                no time making it easier to verify their work. The result?
                Developers spend 80% of their time reviewing and 20% prompting.
              </p>
              <p>
                <span className="text-white font-semibold">
                  Isolation enables scale.
                </span>{" "}
                When each agent runs in its own container with its own VS Code
                instance, you eliminate the confusion of shared state. Every
                diff is clean. Every terminal output is separate. Every
                verification is independent.
              </p>
              <p>
                <span className="text-white font-semibold">
                  Verification is non-negotiable.
                </span>{" "}
                Code diffs are just the start. We need to see the running
                application, the test results, the performance metrics—all in
                real-time, for every agent, without switching contexts.
              </p>
            </div>
          </div>
        </section>

        <div className="flex justify-center py-8">
          <div className="w-48 h-px bg-neutral-800"></div>
        </div>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">
              How cmux works today
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ClientIcon
                      icon={GitBranch}
                      className="h-4 w-4 text-neutral-500"
                      aria-hidden="true"
                    />
                    Separate VS Code windows
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Each agent runs in its own VS Code on a different port.
                    localhost:8001, :8002, :8003. Click to open any of them.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ClientIcon
                      icon={Users}
                      className="h-4 w-4 text-neutral-500"
                      aria-hidden="true"
                    />
                    Multiple agent support
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Claude Code, Codex, Gemini CLI, Amp, plus OpenCode variants.
                    Particularly useful for Kimi K2, Qwen3 Coder, and GLM-4.5
                    alongside Claude Opus.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ClientIcon
                      icon={Star}
                      className="h-4 w-4 text-neutral-500"
                      aria-hidden="true"
                    />
                    Git extension UI
                  </h3>
                  <p className="text-sm text-neutral-400">
                    On mount, VS Code opens the git extension's diff UI. Review
                    changes without context switching.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ClientIcon
                      icon={FileText}
                      className="h-4 w-4 text-neutral-500"
                      aria-hidden="true"
                    />
                    Rich task input
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Paste images, reference files with @mentions, use markdown
                    formatting. Full web dashboard.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ClientIcon
                      icon={Cloud}
                      className="h-4 w-4 text-neutral-500"
                      aria-hidden="true"
                    />
                    Configurable sandboxes
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Docker by default, or configure with Freestyle, Morph,
                    Daytona, Modal, Beam, or E2B.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <ClientIcon
                      icon={Zap}
                      className="h-4 w-4 text-neutral-500"
                      aria-hidden="true"
                    />
                    Task management
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Track parallel executions, view task history, keep
                    containers alive when needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-center py-8">
          <div className="w-48 h-px bg-neutral-800"></div>
        </div>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              The real bottleneck
            </h2>
            <div className="space-y-4 text-neutral-400">
              <p>
                You've probably tried running multiple Claude instances at once.
                Maybe you had 3-4 terminals open, each with a different agent
                working on a different part of your codebase. It starts fine,
                but quickly becomes chaos. Which terminal is working on the auth
                system? Did the one refactoring the database actually finish?
                You're constantly switching between windows, running git diff,
                trying to piece together what changed where.
              </p>
              <p>
                The problem isn't the agents—they're getting scary good. The
                problem is that we're using developer tools built for a
                different era. VS Code was designed for writing code, not for
                reviewing 5 parallel streams of AI-generated changes. Your
                terminal was built for sequential commands, not for managing a
                fleet of autonomous agents.
              </p>
              <p>
                Every additional agent you run multiplies the confusion. You
                need to remember which port each VS Code server is on. You need
                to mentally map which agent is touching which files. You need to
                verify that each task actually completed correctly, not just
                that the agent claims it did. By the time you've verified one
                agent's work, the other four have been sitting idle.
              </p>
              <p>
                cmux fixes this by giving each agent its own world. Separate
                Docker container, separate VS Code instance, separate git state.
                The VS Code opens with the git diff already showing. Every
                change is isolated to its task. You can see exactly what each
                agent did, immediately, without losing context on the others.
                This isn't just convenience—it's what makes running 10+ agents
                actually possible.
              </p>
            </div>
          </div>
        </section>

        <div className="flex justify-center py-8">
          <div className="w-48 h-px bg-neutral-800"></div>
        </div>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">The roadmap</h2>
            <div className="space-y-6">
              <div className="text-neutral-400">
                <p className="mb-6">
                  We're building the missing layer between AI agents and
                  developers. Not another agent, not another IDE—but the
                  verification interface that makes managing 10, 20, or 100
                  parallel agents as easy as managing one.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-3 text-lg">
                    Verification at scale
                  </h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    Every code change will have a visual preview. Backend API
                    changes show request/response diffs. Frontend changes show
                    before/after screenshots. Database migrations show schema
                    changes visually.
                  </p>
                </div>
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-3 text-lg">
                    Intelligent task routing
                  </h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    Automatically route tasks to the best agent based on
                    performance history. Claude for complex refactors, Codex for
                    test generation, specialized models for documentation.
                  </p>
                </div>
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-3 text-lg">
                    Verification workflows
                  </h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    Define verification criteria upfront. Set test coverage
                    requirements, performance benchmarks, security checks.
                    Agents can't mark tasks complete until verification passes.
                  </p>
                </div>
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-3 text-lg">
                    Cross-agent coordination
                  </h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    Agents will communicate through a shared context layer. One
                    agent's output becomes another's input. Automatic conflict
                    resolution when agents modify the same files.
                  </p>
                </div>
              </div>
              <div className="mt-8 p-6 bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg">
                <h3 className="font-semibold mb-3">
                  The endgame: Autonomous verification
                </h3>
                <p className="text-sm text-neutral-400">
                  Eventually, verification itself will be automated. A manager
                  agent will review the work of worker agents, using the same
                  interfaces you use today. It will approve simple changes,
                  escalate complex ones, and learn from your verification
                  patterns. The goal isn't to replace developers—it's to amplify
                  them 100x by removing the verification bottleneck entirely.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-center py-8">
          <div className="w-48 h-px bg-neutral-800"></div>
        </div>

        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4">Requirements</h2>
            <p className="text-neutral-400 mb-8">
              cmux runs locally on your machine. You'll need:
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-3">
                Docker installed
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-3">
                Node.js 18+ or Bun
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-3">
                macOS or Linux
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-center py-8">
          <div className="w-48 h-px bg-neutral-800"></div>
        </div>
      </main>

      <footer className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <ClientIcon
              icon={Terminal}
              className="h-4 w-4 text-neutral-500"
              aria-hidden="true"
            />
            <span className="text-sm text-neutral-500 font-mono">
              cmux by manaflow
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-neutral-500">
            <a
              href="https://github.com/manaflow-ai/cmux"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://twitter.com/manaflowai"
              className="hover:text-white transition-colors"
            >
              Twitter
            </a>
            <a
              href="https://discord.gg/7VY58tftMg"
              className="hover:text-white transition-colors"
            >
              Discord
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
