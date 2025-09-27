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
                AI Workflow Builder for Businesses
              </h1>

              <p className="text-lg text-neutral-300 mb-4 leading-relaxed">
                cmux is an AI workflow builder that helps businesses automate development tasks at scale. Orchestrate
                multiple AI agents including Claude Code, Codex, Gemini CLI, and more to build, test, and ship code
                faster while maintaining quality and control.
              </p>
              <p className="text-lg text-neutral-300 mb-4 leading-relaxed">
                Transform your development workflow with isolated, verifiable AI environments. Each agent runs in its
                own containerized VS Code instance, enabling teams to scale development capacity without sacrificing
                code quality or security.
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
            Built for Modern Development Teams
          </h2>

          <div className="space-y-8 text-neutral-400 mb-12">
            <div className="space-y-2">
              <p>
                <span className="text-white font-semibold">
                  Scale your development capacity instantly.
                </span>{" "}
                Modern businesses need to ship faster without compromising quality.
                cmux enables your team to leverage AI agents effectively, reducing
                development time by 70% while maintaining full control and visibility.
              </p>
              <blockquote className="border-l-2 border-neutral-800 pl-4 text-neutral-300">
                <p>
                  Traditional development workflows break down when you need to
                  manage multiple AI agents. Teams struggle with coordination,
                  verification, and maintaining code quality across parallel
                  workstreams. cmux solves this with unified orchestration.
                </p>
              </blockquote>
            </div>
            <div className="space-y-2">
              <p>
                <span className="text-white font-semibold">
                  Enterprise-grade isolation and security.
                </span>{" "}
                Each AI workflow runs in its own secure container, ensuring complete
                isolation between tasks. Your code, credentials, and business logic
                remain protected while enabling parallel execution at scale.
              </p>
              <blockquote className="border-l-2 border-neutral-800 pl-4 text-neutral-300">
                <p>
                  Your business needs tools designed for AI-powered development.
                  cmux provides the infrastructure to manage dozens of AI agents
                  simultaneously, with enterprise features like audit trails,
                  role-based access control, and seamless integration with your
                  existing tech stack.
                </p>
              </blockquote>
            </div>
            <div className="space-y-2">
              <p>
                <span className="text-white font-semibold">
                  Built-in quality assurance.
                </span>{" "}
                Every AI-generated change is automatically verified through your
                existing CI/CD pipelines. See diffs, test results, and performance
                metrics in real-time, ensuring production-ready code every time.
              </p>
              <blockquote className="border-l-2 border-neutral-800 pl-4 text-neutral-300">
                <p>
                  With cmux, your team gets complete visibility into every AI
                  workflow. Track progress, review changes, and deploy with
                  confidence. Our platform integrates with your existing tools
                  and processes, making AI adoption seamless and risk-free for
                  your organization.
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
                  Separate VS Code IDE instances
                </h3>
                <p className="text-sm text-neutral-400">
                  Each agent runs in its own VS Code instance. You can open them
                  in your IDE of choice, locally or remotely.
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
                  Claude Code, Codex, Gemini CLI, Amp, Opencode, and other
                  coding agent CLIs. Particularly useful to run agents together
                  and find the best one for the task.
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
                  On mount, VS Code opens the git extension&apos;s diff UI. Review
                  changes without context switching.
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
                  Sandbox environment preview
                </h3>
                <p className="text-sm text-neutral-400">
                  Spin up isolated sandboxes to preview your changes safely.
                  cmux uses fast cloud sandboxes or Docker locally.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon
                    icon={GitPullRequest}
                    className="h-4 w-4 text-neutral-500"
                    aria-hidden="true"
                  />
                  Code review page
                </h3>
                <p className="text-sm text-neutral-400">
                  Central place to review changes across agents. View diffs for
                  draft PRs and committed work without leaving the dashboard.
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
                  Track parallel executions, view task history, keep containers
                  alive when needed.
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
            The roadmap
          </h2>
          <div className="space-y-6">
            <div className="text-neutral-400">
              <p className="mb-6">
                We&apos;re building the enterprise platform for AI-powered software
                development. Enable your teams to leverage AI at scale while
                maintaining governance, security, and quality standards that
                enterprise businesses demand.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                <h3 className="font-semibold mb-3 text-lg">
                  Enterprise Compliance & Governance
                </h3>
                <p className="text-sm text-neutral-400 mb-4">
                  Built-in compliance tracking for regulated industries. Audit
                  trails for every AI decision, SOC 2 compliant infrastructure,
                  and role-based access controls ensure your business meets
                  security and regulatory requirements.
                </p>
              </div>
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                <h3 className="font-semibold mb-3 text-lg">
                  Cost Optimization & ROI Tracking
                </h3>
                <p className="text-sm text-neutral-400 mb-4">
                  Monitor AI usage costs across your organization. Intelligent
                  routing ensures you use the most cost-effective model for each
                  task. Built-in analytics show ROI and productivity gains in
                  real-time.
                </p>
              </div>
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                <h3 className="font-semibold mb-3 text-lg">
                  Custom Workflow Templates
                </h3>
                <p className="text-sm text-neutral-400 mb-4">
                  Create reusable workflow templates for common business processes.
                  Define approval chains, quality gates, and integration points.
                  Standardize AI usage across teams while allowing flexibility.
                </p>
              </div>
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
                <h3 className="font-semibold mb-3 text-lg">
                  API & Integration Platform
                </h3>
                <p className="text-sm text-neutral-400 mb-4">
                  Connect cmux to your existing tech stack via REST APIs and
                  webhooks. Integrate with Jira, GitHub, GitLab, Slack, and
                  your CI/CD pipelines for seamless workflow automation.
                </p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-neutral-900/60 border border-neutral-800 rounded-lg">
              <h3 className="font-semibold mb-3">
                The Future: Autonomous Business Operations
              </h3>
              <p className="text-sm text-neutral-400">
                Transform your entire software development lifecycle with AI.
                From requirements gathering to deployment, cmux will orchestrate
                complex workflows that adapt to your business needs. Reduce
                time-to-market by 10x while maintaining enterprise standards
                for quality, security, and compliance.
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
