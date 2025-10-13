import CmuxLogo from "@/components/logo/cmux-logo";
import { BrowserFrame } from "@/components/ui/browser-frame";
import { MacDownloadLink } from "@/components/mac-download-link";
import {
  ArrowRight,
  Cloud,
  GitBranch,
  GitPullRequest,
  Layers,
  MonitorSmartphone,
  Server,
  Settings,
  ShieldCheck,
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
import {
  DMG_SUFFIXES,
  GITHUB_RELEASE_URL,
  MacArchitecture,
  MacDownloadUrls,
  RELEASE_PAGE_URL,
} from "@/lib/releases";

const normalizeVersion = (tag: string): string =>
  tag.startsWith("v") ? tag.slice(1) : tag;

type GithubRelease = {
  tag_name?: string;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
  }>;
};

type ReleaseInfo = {
  latestVersion: string | null;
  macDownloadUrls: MacDownloadUrls;
  fallbackUrl: string;
};

const deriveReleaseInfo = (data: GithubRelease | null): ReleaseInfo => {
  const emptyDownloads: MacDownloadUrls = {
    arm64: null,
    x64: null,
  };

  if (!data) {
    return {
      latestVersion: null,
      macDownloadUrls: emptyDownloads,
      fallbackUrl: RELEASE_PAGE_URL,
    };
  }

  const latestVersion =
    typeof data.tag_name === "string" && data.tag_name.trim() !== ""
      ? normalizeVersion(data.tag_name)
      : null;

  const macDownloadUrls: MacDownloadUrls = {
    arm64: null,
    x64: null,
  };

  if (Array.isArray(data.assets)) {
    for (const asset of data.assets) {
      const assetName = asset.name?.toLowerCase();

      if (typeof assetName !== "string") {
        continue;
      }

      for (const architecture of Object.keys(DMG_SUFFIXES) as MacArchitecture[]) {
        const suffix = DMG_SUFFIXES[architecture];

        if (assetName.endsWith(suffix)) {
          const downloadUrl = asset.browser_download_url;

          if (typeof downloadUrl === "string" && downloadUrl.trim() !== "") {
            macDownloadUrls[architecture] = downloadUrl;
          }
        }
      }
    }
  }

  return {
    latestVersion,
    macDownloadUrls,
    fallbackUrl: RELEASE_PAGE_URL,
  };
};

async function fetchLatestRelease(): Promise<ReleaseInfo> {
  try {
    const response = await fetch(GITHUB_RELEASE_URL, {
      headers: {
        Accept: "application/vnd.github+json",
      },
      next: {
        revalidate: 3600,
      },
    });

    if (!response.ok) {
      return deriveReleaseInfo(null);
    }

    const data = (await response.json()) as GithubRelease;

    return deriveReleaseInfo(data);
  } catch (error) {
    console.error("Failed to retrieve latest GitHub release", error);

    return deriveReleaseInfo(null);
  }
}

const heroHighlights = [
  {
    title: "Orchestrate elite agents",
    description: "Spin up Claude Code, Codex, Gemini CLI, and more inside one command center.",
  },
  {
    title: "Isolation you can trust",
    description: "Every task lives inside its own Docker + VS Code capsule with diff-first views.",
  },
  {
    title: "Verification-first velocity",
    description: "Ship faster by reviewing logs, tests, and diffs without leaving the flow.",
  },
];

const productPillars = [
  {
    title: "Task board built for AI teams",
    description:
      "Queue, scope, and assign workstreams to multiple agents with context-rich task briefs and guardrails.",
    icon: Layers,
  },
  {
    title: "Realtime control surface",
    description:
      "Monitor terminal feeds, container health, and commit-ready diffs at once—no alt-tab archaeology.",
    icon: MonitorSmartphone,
  },
  {
    title: "Source control discipline",
    description:
      "Git-aware automation keeps branches clean, enforces review templates, and blocks merge drift.",
    icon: GitBranch,
  },
  {
    title: "Composability by default",
    description:
      "Blend proprietary models, open-source stacks, or internal copilots without rewriting your tooling.",
    icon: Zap,
  },
  {
    title: "Granular team oversight",
    description:
      "Assign reviewers, observers, and domain experts to each task with real-time status broadcasting to the right people.",
    icon: Users,
  },
  {
    title: "Pull-request ready output",
    description:
      "cmux packages agent work into merge-ready summaries, PR templates, and verification artifacts for whichever repo host you use.",
    icon: GitPullRequest,
  },
];

const workflowSteps = [
  {
    id: "step-repos",
    title: "1. Connect repos and intake specs",
    copy:
      "Point cmux at your GitHub/GitLab repository or drop in a zip. Capture brief, scope, and constraints for each task.",
    checklist: [
      "Placeholder for screenshot: Repository import modal",
      "Placeholder for video: Task brief walkthrough",
      "Reminder to surface branch naming conventions",
    ],
  },
  {
    id: "step-agents",
    title: "2. Select agents and operating style",
    copy:
      "Mix models per task, assign reviewers, and tune autonomy. Snapshots capture prompts, guardrails, and runtime notes.",
    checklist: [
      "Placeholder for screenshot: Agent selection grid",
      "Placeholder for text: Agent capability matrix",
      "Placeholder for video: Parallel run configuration",
    ],
  },
  {
    id: "step-modes",
    title: "3. Choose execution mode",
    copy:
      "Toggle between local containers, cloud runners, or your secured internal environment. cmux handles provisioning.",
    checklist: [
      "Placeholder for screenshot: Mode selection hover state",
      "Placeholder for diagram: Networking + secrets flow",
      "Placeholder for copy: Ops checklists before launch",
    ],
  },
  {
    id: "step-review",
    title: "4. Review, verify, and ship",
    copy:
      "Aggregate diffs, tests, telemetry, and deployment previews. Approve directly or push to your CI pipeline.",
    checklist: [
      "Placeholder for screenshot: Multi-agent diff review",
      "Placeholder for video: Verification workflow in action",
      "Placeholder for text: QA + rollback guidance",
    ],
  },
];

const modeOptions = [
  {
    title: "Local Docker",
    description:
      "Best for iterative development. cmux spins up ephemeral containers on your machine with isolated volumes and VS Code windows.",
    icon: Server,
    details: [
      "Runs against local repos and secrets",
      "Zero-cost experimentation",
      "Works offline with cached models",
    ],
  },
  {
    title: "Managed Cloud",
    description:
      "Scale-heavy workflows go to our managed cluster. Autoscale dozens of agents, stream logs, and pull down diffs instantly.",
    icon: Cloud,
    details: [
      "SOC2-ready execution environment",
      "Role-based access to tasks and logs",
      "Integration hooks for Slack + PagerDuty",
    ],
  },
  {
    title: "Bring-your-own environment",
    description:
      "Point cmux at your Kubernetes, ECS, or Render setup. We deploy agents inside your network perimeter and respect your IAM.",
    icon: ShieldCheck,
    details: [
      "Secrets stay in your vault",
      "Audit trails pipe into your SIEM",
      "Plug into custom telemetry backends",
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
    title: "Live observability of runs",
    description:
      "Compare agent outputs, watch test suites in real time, and annotate issues without leaving the view.",
    asset: cmuxDemo1,
  },
  {
    title: "End-to-end delivery snapshots",
    description:
      "Capture the final diff, deployment preview, and acceptance checklist in a single audit-ready packet.",
    asset: cmuxDemo2,
  },
  {
    title: "Release-ready validation stream",
    description:
      "Trace each agent's progression, approvals, and timeline markers before you hand the work to CI or production.",
    asset: cmuxDemo3,
  },
];

const roadmapHighlights = [
  {
    title: "Autonomous verifiers",
    description:
      "Supervisor agents that apply your review rubric, flag edge cases, and request human escalation only when needed.",
  },
  {
    title: "Cross-agent choreography",
    description:
      "Context graph that lets agents reuse knowledge, prevent file conflicts, and compose multi-stage workstreams.",
  },
  {
    title: "Developer cockpit",
    description:
      "Unified status dashboard spanning prompts, diffs, tests, telemetry, and approvals across every running agent.",
  },
];

export default async function LandingPage() {
  const { fallbackUrl, latestVersion, macDownloadUrls } =
    await fetchLatestRelease();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#030712] text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-x-[-20%] top-[-30%] h-[40rem] rounded-full bg-gradient-to-br from-blue-600/30 via-sky-500/20 to-purple-600/10 blur-3xl" />
        <div className="absolute inset-x-[30%] top-[20%] h-[30rem] rounded-full bg-gradient-to-br from-cyan-400/20 via-sky-500/20 to-transparent blur-[160px]" />
        <div className="absolute inset-x-[10%] bottom-[-20%] h-[32rem] rounded-full bg-gradient-to-tr from-indigo-500/20 via-blue-700/10 to-transparent blur-[200px]" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur border-b border-white/5 bg-black/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link aria-label="cmux" href="/">
            <div className="flex items-center gap-3">
              <CmuxLogo height={36} label="cmux" showWordmark />
            </div>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a className="text-neutral-300 transition hover:text-white" href="#about">
              Product
            </a>
            <a className="text-neutral-300 transition hover:text-white" href="#workflow">
              Workflow
            </a>
            <a className="text-neutral-300 transition hover:text-white" href="#modes">
              Modes
            </a>
            <Link className="text-neutral-300 transition hover:text-white" href="/tutorial">
              Tutorial
            </Link>
            <a
              className="text-neutral-300 transition hover:text-white"
              href="https://cal.com/team/manaflow/meeting"
              rel="noopener noreferrer"
              target="_blank"
            >
              Contact
            </a>
            <a
              className="text-neutral-300 transition hover:text-white"
              href="https://github.com/manaflow-ai/cmux"
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </nav>
          <div className="hidden md:flex">
            <MacDownloadLink
              autoDetect
              fallbackUrl={fallbackUrl}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-neutral-100"
              title={
                latestVersion
                  ? `Download cmux ${latestVersion} for macOS`
                  : "Download cmux for macOS"
              }
              urls={macDownloadUrls}
            >
              <span>Download</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </MacDownloadLink>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-neutral-300">
                Parallel agent operating system
              </div>
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Command center for multi-agent development at production scale
                </h1>
                <p className="max-w-xl text-base text-neutral-300 sm:text-lg">
                  cmux gives high-performing engineering teams a verification-first surface to brief tasks, orchestrate diverse AI coding agents, and ship changes with absolute confidence.
                </p>
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
                  View tutorial playbook
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              {latestVersion ? (
                <p className="text-xs text-neutral-400">
                  Latest: cmux {latestVersion} · Windows & Linux builds in preview — join the waitlist via settings.
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
                  Placeholder for hero video: &ldquo;3 minute flythrough of orchestrating 4 agents on a release.&rdquo;
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="space-y-12">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                Why teams adopt cmux
              </h2>
              <p className="mx-auto max-w-3xl text-sm text-neutral-400 sm:text-base">
                The interface between agents and engineers is the new bottleneck. cmux packages the hard parts—context exchange, verification, and parallel coordination—into a single calm surface.
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
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
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
                  Placeholder for overview video: &ldquo;Full cmux workflow in 7 minutes.&rdquo;
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-400">
                  Placeholder for checklist download: &ldquo;PDF playbook for onboarding.&rdquo;
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

        <section id="modes" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="space-y-12">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">Execution modes for any security posture</h2>
              <p className="mx-auto max-w-2xl text-sm text-neutral-400 sm:text-base">
                Switch between local, managed, or on-prem infrastructure without changing your workflow. Every mode shares the same UI, agent catalog, and verification surfaces.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {modeOptions.map(({ icon: Icon, title, description, details }) => (
                <div
                  key={title}
                  className="flex h-full flex-col rounded-2xl border border-white/10 bg-neutral-950/80 p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-gradient-to-br from-blue-500/50 to-indigo-500/30 p-3 text-white">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <h3 className="text-base font-semibold text-white">{title}</h3>
                  </div>
                  <p className="mt-4 text-sm text-neutral-300">{description}</p>
                  <ul className="mt-6 space-y-2 text-xs text-neutral-400">
                    {details.map((detail) => (
                      <li key={detail} className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-sky-300" aria-hidden />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/5 p-3 text-xs text-neutral-400">
                    Placeholder for deployment diagram or environment-specific guide.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="verification" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
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
                      Placeholder for call-to-action copy: &ldquo;Link to tutorial section for setup.&rdquo;
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

        <section id="roadmap" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">The near-term roadmap</h2>
              <p className="mx-auto max-w-2xl text-sm text-neutral-400 sm:text-base">
                We are building the verification interface that lets teams scale to dozens of agents without losing control.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
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
            <div className="rounded-2xl border border-dashed border-white/15 bg-neutral-950/80 p-6 text-sm text-neutral-400">
              Placeholder for roadmap illustration or quarterly milestones.
            </div>
          </div>
        </section>

        <section id="requirements" className="mx-auto max-w-4xl px-4 pb-20 text-center sm:px-6">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Requirements</h2>
          <p className="mt-4 text-sm text-neutral-400 sm:text-base">
            cmux runs locally or in your environment. Start here:
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <div className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-6 py-4 text-sm text-white sm:w-auto">
              Docker 24+
            </div>
            <div className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-6 py-4 text-sm text-white sm:w-auto">
              macOS 13+, Linux (preview), Windows (waitlist)
            </div>
            <div className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-6 py-4 text-sm text-white sm:w-auto">
              API access to preferred models
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-xs text-neutral-400">
            Placeholder for system diagram: &ldquo;Networking + permissions overview.&rdquo;
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
          <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">Partner with the cmux team</h2>
              <p className="text-sm text-neutral-300 sm:text-base">
                We help advanced engineering orgs design agent operating models, security reviews, and onboarding playbooks.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                href="https://cal.com/team/manaflow/meeting"
                rel="noopener noreferrer"
                target="_blank"
              >
                Book a session
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
