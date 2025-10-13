import { BrowserFrame } from "@/components/ui/browser-frame";
import { MacDownloadLink } from "@/components/mac-download-link";
import { SiteHeader } from "@/components/site-header";
import {
  ArrowRight,
  Cloud,
  GitPullRequest,
  Layers,
  Star,
  Settings,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import cmuxDemo0 from "@/docs/assets/cmux-demo-00.png";
import cmuxDemo1 from "@/docs/assets/cmux-demo-10.png";
import cmuxDemo2 from "@/docs/assets/cmux-demo-20.png";
import cmuxDemo3 from "@/docs/assets/cmux-demo-30.png";
import { fetchLatestRelease } from "@/lib/fetch-latest-release";

const heroHighlights = [
  {
    title: "Run multiple agent CLIs side-by-side",
    description: "Claude Code, Codex, Gemini CLI, Amp, Opencode, and more inside one workspace.",
  },
  {
    title: "Dedicated VS Code per agent",
    description: "Each task launches an isolated VS Code window with the git diff view ready to inspect.",
  },
  {
    title: "Verification-first review flow",
    description: "Stay productive by checking diffs, logs, and task history without losing context.",
  },
];

const productPillars = [
  {
    title: "Separate VS Code IDE instances",
    description:
      "Each agent runs in its own VS Code instance so you can hop between workspaces locally or remotely.",
    icon: Layers,
  },
  {
    title: "Multiple agent support",
    description:
      "Claude Code, Codex, Gemini CLI, Amp, Opencode, and other coding agent CLIs work from the same dashboard.",
    icon: Users,
  },
  {
    title: "Git extension UI",
    description:
      "On mount, VS Code opens straight to the git diff extension so you can review changes without context switching.",
    icon: Star,
  },
  {
    title: "Sandbox environment preview",
    description:
      "Spin up isolated sandboxes to preview your changes safely, using fast cloud sandboxes or Docker locally.",
    icon: Cloud,
  },
  {
    title: "Code review page",
    description:
      "Track draft pull requests and committed work from a central review surface dedicated to parallel agents.",
    icon: GitPullRequest,
  },
  {
    title: "Task management",
    description:
      "Follow parallel executions, view task history, and keep containers alive when you need extra runtime.",
    icon: Zap,
  },
];

const workflowSteps = [
  {
    id: "step-workspaces",
    title: "1. Spin up isolated workspaces",
    copy:
      "Launch cmux and open an agent-specific container plus VS Code session so every run stays clean.",
    checklist: [
      "Ensure Docker Desktop (for local mode) is running or select a cloud runner before startup.",
      "Capture the workspace launch flow so teammates know what to expect.",
      "Keep VS Code windows labeled by agent to avoid confusion.",
    ],
  },
  {
    id: "step-agents",
    title: "2. Run agents in parallel",
    copy:
      "Point Claude Code, Codex, Gemini CLI, Amp, and other CLIs at the same task to compare approaches in real time.",
    checklist: [
      "Document which prompts and guardrails you pair with each agent persona.",
      "Note any prompt handoffs or collaboration patterns worth repeating.",
      "Record a short clip when two agents tackle the same story for showcase reels.",
    ],
  },
  {
    id: "step-review",
    title: "3. Review diffs, logs, and tests",
    copy:
      "Use the diff-first VS Code view, command timeline, and cmux dashboard to verify everything without tab chaos.",
    checklist: [
      "Walk reviewers through the git diff side panel with a quick screen grab.",
      "Annotate terminal output or test logs that need human attention.",
      "Outline the verification checklist you expect every agent run to follow.",
    ],
  },
  {
    id: "step-ship",
    title: "4. Ship confidently",
    copy:
      "Use the code review page to package diffs, document findings, and follow through on next steps with full context.",
    checklist: [
      "Highlight the code review hub that aggregates multi-agent work.",
      "Share a handoff summary clip when you pass work to a reviewer or PM.",
      "Keep a post-run notes template so lessons roll forward into the next sprint.",
    ],
  },
];

const verificationHighlights = [
  {
    title: "Diff-first VS Code workspaces",
    description:
      "Every agent attaches to a dedicated VS Code session, pre-loaded with the relevant repo, diff view, and terminal.",
    asset: cmuxDemo0,
  },
  {
    title: "Parallel agent dashboards",
    description:
      "Watch multiple terminals, prompts, and outputs update together so you always know which agent is on which task.",
    asset: cmuxDemo1,
  },
  {
    title: "Task history and review surfaces",
    description:
      "Track task history, drafts, and verification notes from a single place designed for multi-agent workflows.",
    asset: cmuxDemo2,
  },
];

const roadmapHighlights = [
  {
    title: "Verification at scale",
    description:
      "Every code change will have a visual preview—API diffs, before/after screenshots, and database migrations rendered clearly.",
  },
  {
    title: "Intelligent task routing",
    description:
      "Automatically route tasks to the best agent personas based on performance history and domain expertise.",
  },
  {
    title: "Verification workflows",
    description:
      "Define verification criteria upfront so agents cannot mark tasks complete until every requirement passes.",
  },
  {
    title: "Cross-agent coordination",
    description:
      "Give agents a shared context layer so one agent's output can feed the next while avoiding file conflicts.",
  },
];

export default async function LandingPage() {
  const { fallbackUrl, latestVersion, macDownloadUrls } =
    await fetchLatestRelease();

  return (
    <div className="relative flex min-h-dvh flex-col bg-[#030712] text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute inset-x-[-20%] top-[-30%] h-[40rem] rounded-full bg-gradient-to-br from-blue-600/30 via-sky-500/20 to-purple-600/10 blur-3xl" />
        <div className="absolute inset-x-[30%] top-[20%] h-[30rem] rounded-full bg-gradient-to-br from-cyan-400/20 via-sky-500/20 to-transparent blur-[160px]" />
        <div className="absolute inset-x-[10%] bottom-[-20%] h-[32rem] rounded-full bg-gradient-to-tr from-indigo-500/20 via-blue-700/10 to-transparent blur-[200px]" />
      </div>

            <SiteHeader
        fallbackUrl={fallbackUrl}
        latestVersion={latestVersion}
        macDownloadUrls={macDownloadUrls}
      />

      <main className="relative z-10 flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-neutral-300">
                Parallel agent operating system
              </div>
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Universal AI coding agent manager for 10x engineers
                </h1>
                <div className="space-y-4 text-base text-neutral-300 sm:text-lg">
                  <p>
                    cmux is a universal AI coding agent manager that supports Claude Code, Codex, Gemini CLI, Amp, Opencode, and other coding CLIs. We give 10x engineers an interface to manage AI coding tasks in parallel, context switch fast, and verify AI-generated code to stay actually productive with AI.
                  </p>
                  <p>
                    Every run spins up an isolated VS Code workspace—whether you choose our managed cloud runners or a local Docker container—with the git diff view and terminal ready so parallel agent work stays verifiable, fast, and ready to ship.
                  </p>
                  <p className="text-sm text-neutral-400 sm:text-base">
                    Learn more about the
                    {" "}
                    <a
                      className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4"
                      href="#nav-about"
                    >
                      vision
                    </a>
                    ,
                    {" "}
                    <a
                      className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4"
                      href="#nav-features"
                    >
                      how it works today
                    </a>
                    , or explore the
                    {" "}
                    <a
                      className="text-sky-400 hover:text-sky-300 underline decoration-dotted underline-offset-4"
                      href="#nav-roadmap"
                    >
                      roadmap
                    </a>
                    .
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <MacDownloadLink
                  autoDetect
                  fallbackUrl={fallbackUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white px-4 py-3 text-sm font-semibold text-black shadow-xl transition hover:bg-neutral-100"
                  title={
                    latestVersion
                      ? `Download cmux ${latestVersion} for macOS`
                      : "Download cmux for macOS"
                  }
                  urls={macDownloadUrls}
                >
                  <span>Download for macOS</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </MacDownloadLink>
                <Link
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                  href="/tutorial"
                >
                  Read the full tutorial
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              {latestVersion ? (
                <p className="text-xs text-neutral-400">
                  Latest release: cmux {latestVersion}. Need another build? Visit the GitHub release page for all downloads.
                </p>
              ) : (
                <p className="text-xs text-neutral-400">
                  Having trouble with the macOS download? Use the fallback build on our release page.
                </p>
              )}
            </div>
            <div className="relative">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_40px_120px_-40px_rgba(56,189,248,0.35)] backdrop-blur lg:ml-auto lg:max-w-lg">
                <div className="space-y-6">
                  {heroHighlights.map((highlight) => (
                    <div key={highlight.title} className="flex gap-4">
                      <div className="mt-0.5 h-8 w-8 flex-none rounded-full bg-gradient-to-br from-sky-500/80 to-indigo-500/80 text-center text-base font-semibold leading-8 text-white shadow-lg">
                        •
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-white">
                          {highlight.title}
                        </h3>
                        <p className="text-sm text-neutral-300">{highlight.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 rounded-xl border border-dashed border-white/20 bg-neutral-950/60 p-4 text-xs text-neutral-400">
                  Video walkthrough coming soon: &ldquo;Three-minute flythrough of orchestrating four agents on a release.&rdquo;
                </div>
              </div>
            </div>
          </div>
          <div className="mt-16 relative overflow-hidden rounded-3xl border border-white/10">
            <Image
              src={cmuxDemo0}
              alt="cmux dashboard showing parallel AI agents"
              width={3248}
              height={2112}
              sizes="(min-width: 1024px) 1024px, 100vw"
              quality={100}
              className="w-full h-auto"
              priority
            />
          </div>
        </section>

        <section id="nav-about" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 scroll-mt-32">
          <div className="space-y-12">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                Rethinking the developer interface
              </h2>
              <p className="mx-auto max-w-3xl text-sm text-neutral-400 sm:text-base">
                We&apos;ve spent years making AI agents better at coding, but almost no time making it easier to verify their work. cmux focuses on the verification surface so multi-agent teams can stay fast and accurate.
              </p>
            </div>
            <div className="space-y-8 text-sm text-neutral-300 sm:text-base">
              <div className="space-y-2">
                <p>
                  <span className="text-white font-semibold">The interface is the bottleneck.</span>{" "}
                  Developers still spend most of their time reviewing and verifying code instead of prompting. cmux removes the window-juggling and diff spelunking that slows teams down.
                </p>
                <blockquote className="border-l-2 border-white/10 pl-4 text-neutral-200">
                  <p>
                    Running multiple agents at once sounds powerful until it turns into chaos: three or four terminals, each on a different task, and you&apos;re asking, &ldquo;Which one is on auth? Did the database refactor finish?&rdquo;
                  </p>
                </blockquote>
              </div>
              <div className="space-y-2">
                <p>
                  <span className="text-white font-semibold">Isolation enables scale.</span>{" "}
                  Each agent runs in its own container with its own VS Code instance. Every diff is clean, every terminal output is separate, and every verification stays independent.
                </p>
                <blockquote className="border-l-2 border-white/10 pl-4 text-neutral-200">
                  <p>
                    The issue isn&apos;t that agents aren&apos;t good—they&apos;re getting scary good. It&apos;s that our tools were built for a single developer, not for reviewing five parallel streams of AI-generated changes.
                  </p>
                </blockquote>
              </div>
              <div className="space-y-2">
                <p>
                  <span className="text-white font-semibold">Verification is non-negotiable.</span>{" "}
                  Code diffs are just the start. We need to see running apps, test results, and metrics for every agent without losing context. cmux keeps that verification front and center.
                </p>
                <blockquote className="border-l-2 border-white/10 pl-4 text-neutral-200">
                  <p>
                    cmux gives each agent its own world: separate container in the cloud or Docker, separate VS Code, separate git state. You can see exactly what changed immediately—without losing context.
                  </p>
                </blockquote>
              </div>
            </div>
            <div className="mt-12 relative overflow-hidden rounded-2xl border border-white/10">
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

        <section id="nav-features" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 scroll-mt-32">
          <div className="space-y-12">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                How cmux works today
              </h2>
              <p className="mx-auto max-w-3xl text-sm text-neutral-400 sm:text-base">
                The cmux dashboard keeps every agent and workspace organized so you can launch, monitor, and review without alt-tabbing between terminals.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {productPillars.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-gradient-to-br from-sky-500/40 via-blue-500/40 to-purple-500/40 p-3 text-white shadow-lg">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-white">{title}</h3>
                      <p className="text-sm text-neutral-300">{description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 relative overflow-hidden rounded-2xl border border-white/10">
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

        <section id="nav-workflow" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 scroll-mt-32">
          <div className="flex flex-col gap-16 lg:flex-row">
            <div className="lg:w-1/3">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                A guided workflow from intake to verification
              </h2>
              <p className="mt-4 text-sm text-neutral-400 sm:text-base">
                Each phase inside cmux surfaces the right context, guardrails, and automation to keep humans confident while agents execute in parallel.
              </p>
              <div className="mt-8 space-y-6">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-400">
                  Workflow overview video coming soon: &ldquo;Full cmux workflow in 7 minutes.&rdquo;
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-400">
                  Onboarding playbook PDF in production—join the Discord to get notified when it drops.
                </div>
              </div>
            </div>
            <div className="grid flex-1 gap-6 sm:grid-cols-2">
              {workflowSteps.map((step, index) => (
                <article
                  key={step.id}
                  className="flex flex-col justify-between rounded-2xl border border-white/10 bg-neutral-950/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                >
                  <div className="space-y-4">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold text-white">{step.title}</h3>
                      <p className="text-sm text-neutral-300">{step.copy}</p>
                    </div>
                    <ul className="space-y-2 text-xs text-neutral-400">
                      {step.checklist.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 bg-white/5 px-3 py-2"
                        >
                          <Settings className="h-3.5 w-3.5 flex-none text-sky-300" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="nav-verification" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 scroll-mt-32">
          <div className="space-y-10">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                Verification views that make scale trustworthy
              </h2>
              <p className="mx-auto max-w-3xl text-sm text-neutral-400 sm:text-base">
                Doc-style reviews, live terminals, and side-by-side diffs keep humans in the loop without killing velocity.
              </p>
            </div>
            <div className="grid gap-10">
              {verificationHighlights.map((highlight, index) => (
                <div
                  key={highlight.title}
                  className="grid gap-8 lg:grid-cols-2 lg:items-center"
                >
                  <div className={`space-y-3 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                    <h3 className="text-xl font-semibold text-white">{highlight.title}</h3>
                    <p className="text-sm text-neutral-300">{highlight.description}</p>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-400">
                      Need setup tips? Jump to the tutorial&apos;s verification chapter for the walkthrough.
                    </div>
                  </div>
                  <BrowserFrame
                    className={index % 2 === 1 ? "lg:order-1" : ""}
                    url="https://app.cmux.dev/task/verification"
                  >
                    <Image
                      alt={highlight.title}
                      className="w-full rounded-b-xl border-t border-neutral-200/60 dark:border-neutral-800"
                      height={2112}
                      priority={index === 0}
                      quality={100}
                      sizes="(min-width: 1024px) 640px, 100vw"
                      src={highlight.asset}
                      width={3248}
                    />
                  </BrowserFrame>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="nav-roadmap" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 scroll-mt-32">
          <div className="space-y-10">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">The roadmap</h2>
              <p className="mx-auto max-w-3xl text-sm text-neutral-400 sm:text-base">
                We&apos;re building the missing layer between AI agents and developers. Not another agent, not another IDE—but the verification interface that makes managing 10, 20, or 100 parallel agents as easy as managing one.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {roadmapHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left"
                >
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm text-neutral-300">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-neutral-950/80 p-6 text-sm text-neutral-300">
              <h3 className="text-base font-semibold text-white">The endgame: Autonomous verification</h3>
              <p className="mt-3">
                Eventually, verification itself will be automated. A manager agent will review the work of worker agents, using the same interfaces you use today. It will approve simple changes, escalate complex ones, and learn from your verification patterns.
              </p>
              <p className="mt-3">
                The goal isn&apos;t to replace developers—it&apos;s to amplify them 100x by removing the verification bottleneck entirely.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10">
              <Image
                src={cmuxDemo3}
                alt="cmux verification views"
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

        <section id="nav-requirements" className="mx-auto max-w-4xl px-4 pb-20 text-center sm:px-6 scroll-mt-32">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Requirements</h2>
          <p className="mt-4 text-sm text-neutral-400 sm:text-base">
            cmux runs locally on your machine. You&apos;ll need:
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <div className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-6 py-4 text-sm text-white sm:w-auto text-center">
              Docker installed <span className="text-neutral-400">(for local mode)</span> or access to cmux cloud runners
            </div>
            <div className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-6 py-4 text-sm text-white sm:w-auto text-center">
              macOS or Linux for local containers; any OS works with cloud
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-xs text-neutral-400">
            System diagram for networking and permissions is in progress—reach out if you need early access.
          </div>
        </section>

        <section id="nav-contact" className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 scroll-mt-32">
          <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">Talk to the team</h2>
              <p className="text-sm text-neutral-300 sm:text-base">
                Curious how cmux can power your workflow? Book time with us for a demo or deep dive.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                href="https://cal.com/team/manaflow/meeting"
                rel="noopener noreferrer"
                target="_blank"
              >
                Book a meeting
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                href="/tutorial"
              >
                Browse full tutorial
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-8 text-sm text-neutral-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-neutral-600" aria-hidden />
            <span className="font-mono">cmux by manaflow</span>
          </div>
          <div className="flex items-center gap-6">
            <a className="transition hover:text-white" href="/tutorial">
              Tutorial
            </a>
            <a
              className="transition hover:text-white"
              href="https://github.com/manaflow-ai/cmux"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <a
              className="transition hover:text-white"
              href="https://twitter.com/manaflowai"
              rel="noopener noreferrer"
              target="_blank"
            >
              Twitter
            </a>
            <a
              className="transition hover:text-white"
              href="https://discord.gg/7VY58tftMg"
              rel="noopener noreferrer"
              target="_blank"
            >
              Discord
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
