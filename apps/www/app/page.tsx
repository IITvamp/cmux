"use client";

import clientPackageJson from "../../client/package.json" assert { type: "json" };

import { ClientIcon } from "@/components/client-icon";
import CmuxLogo from "@/components/logo/cmux-logo";
import { Cloud, GitBranch, GitPullRequest, Star, Terminal, Users, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import cmuxDemo0 from "@/docs/assets/cmux-demo-00.png";
import cmuxDemo1 from "@/docs/assets/cmux-demo-10.png";
import cmuxDemo2 from "@/docs/assets/cmux-demo-20.png";
import cmuxDemo3 from "@/docs/assets/cmux-demo-30.png";

const RELEASE_PAGE_URL = "https://github.com/manaflow-ai/cmux/releases/latest";

const normalizeVersion = (tag: string): string => (tag.startsWith("v") ? tag.slice(1) : tag);

const ensureTagPrefix = (value: string): string => (value.startsWith("v") ? value : `v${value}`);

type ReleaseInfo = {
  latestVersion: string | null;
  macDownloadUrl: string;
};

const deriveReleaseInfo = (): ReleaseInfo => {
  const versionValue = clientPackageJson.version;

  if (typeof versionValue !== "string" || versionValue.trim() === "") {
    return {
      latestVersion: null,
      macDownloadUrl: RELEASE_PAGE_URL,
    };
  }

  const normalizedVersion = normalizeVersion(versionValue);
  const releaseTag = ensureTagPrefix(versionValue);

  return {
    latestVersion: normalizedVersion,
    macDownloadUrl: `https://github.com/manaflow-ai/cmux/releases/download/${releaseTag}/cmux-${normalizedVersion}-arm64.dmg`,
  };
};

const RELEASE_INFO = deriveReleaseInfo();

export default function LandingPage() {
  const { macDownloadUrl, latestVersion } = RELEASE_INFO;

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
                AI workflow builder for businesses
              </h1>

              <p className="text-lg text-neutral-300 mb-4 leading-relaxed">
                cmux streamlines business software development by orchestrating multiple AI coding agents in parallel.
                Teams can deploy Claude Code, Codex, Gemini CLI, and other AI tools simultaneously across different
                projects, dramatically accelerating development cycles while maintaining code quality and oversight.
              </p>
              <p className="text-lg text-neutral-300 mb-4 leading-relaxed">
                Each workflow runs in isolated VS Code environments with built-in verification tools, ensuring
                your business can scale AI-assisted development safely and efficiently.
              </p>
              <p className="text-lg text-neutral-300 leading-relaxed">
                Learn more about the{" "}
                <a
                  href="#about"
                  className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4"
                >
                  {" "}
                  vision
                </a>
                ,{" "}
                <a
                  href="#features"
                  className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4"
                >
                  how it works
                </a>
                , or see the{" "}
                <a
                  href="#roadmap"
                  className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4"
                >
                  roadmap
                </a>
                .
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
                <a
                  href={macDownloadUrl}
                  title={latestVersion ? `Download cmux v${latestVersion} for macOS arm64` : "Requires macOS"}
                  className="inline-flex h-12 items-center gap-2 text-base font-medium text-black bg-white hover:bg-neutral-50 border border-neutral-800 rounded-lg px-4 transition-all whitespace-nowrap"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 16 16"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M12.665 15.358c-.905.844-1.893.711-2.843.311-1.006-.409-1.93-.427-2.991 0-1.33.551-2.03.391-2.825-.31C-.498 10.886.166 4.078 5.28 3.83c1.246.062 2.114.657 2.843.71 1.09-.213 2.133-.826 3.296-.746 1.393.107 2.446.64 3.138 1.6-2.88 1.662-2.197 5.315.443 6.337-.526 1.333-1.21 2.657-2.345 3.635zM8.03 3.778C7.892 1.794 9.563.16 11.483 0c.268 2.293-2.16 4-3.452 3.777"
                    ></path>
                  </svg>
                  Download for Mac
                  {latestVersion ? ` (v${latestVersion})` : null}
                </a>
                <a
                  href="https://github.com/manaflow-ai/cmux"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 h-12 bg-neutral-900 text-white border border-neutral-800 hover:bg-neutral-800 rounded-lg font-medium transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    aria-hidden="true"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>View on GitHub</span>
                </a>
              </div>
            </div>
          </div>
          {/* First demo image combined with hero */}
          <div className="mt-16 mb-8 relative overflow-hidden rounded-lg">
            <Image
              src={cmuxDemo0}
              alt="cmux dashboard showing task management for AI agents"
              width={3248}
              height={2112}
              sizes="(min-width: 1024px) 1024px, 100vw"
              quality={100}
              className="w-full h-auto"
              priority
            />
          </div>
          <div className="flex justify-center">
            <div className="w-48 h-px bg-neutral-800"></div>
          </div>
        </div>
      </section>

      <section id="about" className="pt-8 px-4 sm:px-6 lg:px-12">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-8">
            Scaling business development with AI workflows
          </h2>

          <div className="space-y-8 text-neutral-400 mb-12">
            <div className="space-y-2">
              <p>
                <span className="text-white font-semibold">
                  Modern businesses need faster development cycles.
                </span>{" "}
                Traditional development approaches can't keep pace with market demands.
                AI coding agents offer unprecedented speed, but managing multiple agents
                across business projects becomes chaotic without proper orchestration.
              </p>
              <blockquote className="border-l-2 border-neutral-800 pl-4 text-neutral-300">
                <p>
                  Businesses often struggle to coordinate AI development across teams:
                  multiple agents working on different features, unclear progress tracking,
                  and difficulty ensuring code quality standards. The result is wasted
                  time and inconsistent outcomes.
                </p>
              </blockquote>
            </div>
            <div className="space-y-2">
              <p>
                <span className="text-white font-semibold">
                  Workflow isolation drives business results.
                </span>{" "}
                cmux creates separate development environments for each AI workflow,
                eliminating conflicts and enabling true parallel development.
                Business teams can confidently scale their AI-assisted development
                without sacrificing quality or control.
              </p>
              <blockquote className="border-l-2 border-neutral-800 pl-4 text-neutral-300">
                <p>
                  Traditional development tools weren't designed for AI workflow management.
                  Businesses need platforms that can orchestrate multiple AI agents
                  while maintaining clear oversight, progress tracking, and quality
                  assurance across all development initiatives.
                </p>
              </blockquote>
            </div>
            <div className="space-y-2">
              <p>
                <span className="text-white font-semibold">
                  Business-grade verification and oversight.
                </span>{" "}
                Enterprise development requires comprehensive verification:
                code reviews, automated testing, performance monitoring, and
                compliance checks—all visible in real-time across every
                AI workflow without context switching.
              </p>
              <blockquote className="border-l-2 border-neutral-800 pl-4 text-neutral-300">
                <p>
                  cmux delivers enterprise-ready AI workflow management with
                  isolated Docker environments and dedicated VS Code instances
                  for each workflow. Teams get immediate visibility into every
                  change, automated quality gates, and seamless integration
                  with existing business processes.
                </p>
              </blockquote>
            </div>
          </div>
          <div className="mt-16 mb-8 relative overflow-hidden rounded-lg">
            <Image
              src={cmuxDemo1}
              alt="cmux dashboard showing task management for AI agents"
              width={3248}
              height={2112}
              sizes="(min-width: 1024px) 1024px, 100vw"
              quality={100}
              className="w-full h-auto"
              priority
            />
          </div>
        </div>
      </section>

      <div className="flex justify-center py-8">
        <div className="w-48 h-px bg-neutral-800"></div>
      </div>

      <section id="features" className="pt-8 px-4 sm:px-6 lg:px-12">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-8 text-center">
            Enterprise AI workflow capabilities
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
                  Isolated development environments
                </h3>
                <p className="text-sm text-neutral-400">
                  Each business workflow runs in dedicated VS Code instances
                  with full environment isolation, ensuring clean development
                  cycles and preventing conflicts between projects.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon
                    icon={Users}
                    className="h-4 w-4 text-neutral-500"
                    aria-hidden="true"
                  />
                  Multi-agent orchestration
                </h3>
                <p className="text-sm text-neutral-400">
                  Deploy Claude Code, Codex, Gemini CLI, and other AI agents
                  across your business workflows. Compare agent performance
                  and automatically route tasks to the most effective AI for each job.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon
                    icon={Star}
                    className="h-4 w-4 text-neutral-500"
                    aria-hidden="true"
                  />
                  Built-in code review workflows
                </h3>
                <p className="text-sm text-neutral-400">
                  Integrated git diff UI opens automatically for immediate
                  code review. Streamline approval processes and maintain
                  development standards across all AI-generated code.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon
                    icon={Cloud}
                    className="h-4 w-4 text-neutral-500"
                    aria-hidden="true"
                  />
                  Business-ready testing environments
                </h3>
                <p className="text-sm text-neutral-400">
                  Deploy secure, isolated testing environments for safe
                  validation of AI-generated changes. Support both cloud
                  and on-premises deployment models.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon
                    icon={GitPullRequest}
                    className="h-4 w-4 text-neutral-500"
                    aria-hidden="true"
                  />
                  Centralized workflow dashboard
                </h3>
                <p className="text-sm text-neutral-400">
                  Unified view of all AI workflows across your organization.
                  Track progress, review changes, and manage approvals
                  from a single business intelligence dashboard.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon
                    icon={Zap}
                    className="h-4 w-4 text-neutral-500"
                    aria-hidden="true"
                  />
                  Enterprise task orchestration
                </h3>
                <p className="text-sm text-neutral-400">
                  Comprehensive workflow tracking with execution history,
                  resource management, and business metrics. Scale AI
                  development operations with enterprise-grade controls.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 relative overflow-hidden rounded-lg">
            <Image
              src={cmuxDemo2}
              alt="cmux vscode instances showing diffs"
              width={3248}
              height={2112}
              sizes="(min-width: 1024px) 1024px, 100vw"
              quality={100}
              className="w-full h-auto"
            loading="lazy"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-center py-8">
        <div className="w-48 h-px bg-neutral-800"></div>
      </div>

      <section id="roadmap" className="pt-8 pb-8 px-4 sm:px-6 lg:px-12">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold mb-8 text-center">
            Enterprise roadmap
          </h2>
          <div className="space-y-6">
            <div className="text-neutral-400">
              <p className="mb-6">
                We&apos;re building the enterprise platform that transforms
                how businesses deploy AI for software development. Our focus
                is creating scalable workflow orchestration that enables
                organizations to leverage AI development at unprecedented scale.
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
                  requirements, performance benchmarks, security checks. Agents
                  can&apos;t mark tasks complete until verification passes.
                </p>
              </div>
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                <h3 className="font-semibold mb-3 text-lg">
                  Cross-agent coordination
                </h3>
                <p className="text-sm text-neutral-400 mb-4">
                  Agents will communicate through a shared context layer. One
                  agent&apos;s output becomes another&apos;s input. Automatic conflict
                  resolution when agents modify the same files.
                </p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-neutral-900/60 border border-neutral-800 rounded-lg">
              <h3 className="font-semibold mb-3">
                The endgame: Autonomous verification
              </h3>
              <p className="text-sm text-neutral-400">
                Eventually, verification itself will be automated. A manager
                agent will review the work of worker agents, using the same
                interfaces you use today. It will approve simple changes,
                escalate complex ones, and learn from your verification
                patterns. The goal isn&apos;t to replace developers—it&apos;s to amplify
                them 100x by removing the verification bottleneck entirely.
              </p>
            </div>
          </div>
          <div className="mt-8 relative overflow-hidden rounded-lg">
            <Image
              src={cmuxDemo3}
              alt="cmux vscode instances showing diffs"
              width={3248}
              height={2112}
              sizes="(min-width: 1024px) 1024px, 100vw"
              quality={100}
              className="w-full h-auto"
            loading="lazy"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-center py-8">
        <div className="w-48 h-px bg-neutral-800"></div>
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
              macOS or Linux
            </div>
          </div>
          
        </div>
      </section>

      <div className="flex justify-center py-8">
        <div className="w-48 h-px bg-neutral-800"></div>
      </div>

      <footer className="py-8 px-4 sm:px-6 lg:px-12">
        <div className="container max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
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
