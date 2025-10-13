import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Boxes,
  Camera,
  ClipboardList,
  Cloud,
  GitBranch,
  KeyRound,
  Play,
  ScanEye,
  Server,
  ShieldCheck,
  Sparkles,
  Video,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { TutorialSidebar } from "./sidebar";

const pageSubtitle = "Everything you need to launch high-agency agent workflows inside cmux";

type TutorialSection = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  content: ReactNode;
};

const sections: TutorialSection[] = [
  {
    id: "orientation",
    eyebrow: "Start here",
    title: "Welcome to the cmux control plane",
    summary:
      "Get the lay of the land before you spin up your first multi-agent mission.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <p>
          cmux gives you a cockpit for orchestrating multiple coding agents at
          once. This tutorial is designed to mirror the layout of the product so
          you know exactly where to click, what to expect, and how to keep
          everything verifiable.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <CalloutCard
            icon={Sparkles}
            title="Why cmux"
            description="Parallelize AI coding work with disciplined guardrails so every diff is reviewable, traceable, and ready to merge."
          />
          <CalloutCard
            icon={Activity}
            title="How to use this guide"
            description="Move top-to-bottom. The left sidebar shows the flow we recommend for every onboarding: set prerequisites, wire up repos, configure agents, then launch."
          />
        </div>
        <PlaceholderCard
          icon={Video}
          label="Guided walkthrough video"
          description="TODO: Embed a 4-minute narrated overview that flies through the cmux dashboard, agent rail, diff panel, and task console."
        />
        <CalloutCard
          icon={ClipboardList}
          title="Before you begin"
          description="Gather your Docker credentials, GitHub/GitLab access tokens, and API keys for the agents you plan to run (Claude, GPT-4.1, Gemini Code Assist, etc.)."
        />
      </div>
    ),
  },
  {
    id: "setup",
    eyebrow: "Prerequisites",
    title: "Install cmux and confirm system readiness",
    summary: "Five quick checks keep environments reproducible on day one.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <ol className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950/50 p-5 text-neutral-200">
          <li>
            <strong className="text-white">Download & install cmux.</strong>
            <p className="mt-1 text-neutral-400">
              Use the macOS build for your architecture from the landing page or
              run <code>brew install cmux</code> (coming soon). During install we
              provision background daemons for Docker orchestration and per-task
              sandboxing.
            </p>
            <PlaceholderCard
              icon={Camera}
              label="Installer screenshot"
              description="TODO: Capture the installer success state with callouts for the Docker helper and command palette shortcut."
            />
          </li>
          <li>
            <strong className="text-white">Verify Docker is available.</strong>
            <p className="mt-1 text-neutral-400">
              From the command palette run <code>System Diagnostics</code> and
              confirm the Docker engine, disk quotas, and default network bridge
              all pass. cmux uses this check to decide whether Local Docker mode
              is eligible.
            </p>
          </li>
          <li>
            <strong className="text-white">Connect your source control identity.</strong>
            <p className="mt-1 text-neutral-400">
              Head to Settings{" -> "}Integrations{" -> "}Git Providers, then authenticate
              with GitHub, GitLab, or Bitbucket. This lets cmux clone repositories
              directly into isolated workspaces.
            </p>
            <PlaceholderCard
              icon={Camera}
              label="Integrations screenshot"
              description="TODO: Drop in a screenshot highlighting the Git provider cards and the 'Connect' CTA."
            />
          </li>
          <li>
            <strong className="text-white">Invite collaborators (optional).</strong>
            <p className="mt-1 text-neutral-400">
              Add teammates from the Workspace{" -> "}People tab so they inherit
              environment defaults, agent libraries, and task logs.
            </p>
          </li>
          <li>
            <strong className="text-white">Review compliance guardrails.</strong>
            <p className="mt-1 text-neutral-400">
              Settings{" -> "}Compliance lets you enforce review sign-off, secret
              redaction, and runtime limits per workspace before any tasks are
              executed.
            </p>
          </li>
        </ol>
      </div>
    ),
  },
  {
    id: "agents",
    eyebrow: "Core concept",
    title: "Select the right agents for each mission",
    summary: "Mix-and-match Claude Code, GPT, Gemini, and custom agents without losing oversight.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <p>
          Open the Task Composer and use the agent rail to add or remove models.
          Each agent definition bundles a provider (Anthropic, OpenAI, Google), a
          persona, and default prompts that align with your engineering rituals.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard
            title="Agent templates"
            description="Start with curated presets (Claude Code Review, GPT-4.1 Refactor, Gemini CI Fixer) or save your own." 
            icon={BookOpen}
          />
          <FeatureCard
            title="Capability tags"
            description="Hover over an agent to inspect supported languages, tooling proficiency, latency tiers, and cost per task."
            icon={ShieldCheck}
          />
        </div>
        <ol className="list-decimal space-y-3 pl-6">
          <li>
            Click <span className="font-medium text-white">Add agent</span>
            {" -> "}
            choose from the library or import via API schema.
          </li>
          <li>
            Pin the primary agent to set the authoritative diff stream and
            determine whose output populates the summary view.
          </li>
          <li>
            Use the <code>Role</code> dropdown to assign Review, Implement, or
            Research duties so cmux auto-routes tasks and evaluation criteria.
          </li>
        </ol>
        <PlaceholderCard
          icon={Camera}
          label="Agent rail screenshot"
          description="TODO: Annotate the agent selector, capability tags, and role picker."
        />
      </div>
    ),
  },
  {
    id: "modes",
    eyebrow: "Execution",
    title: "Choose how cmux runs your workloads",
    summary: "Toggle between Local Docker, Cloud, and managed Cloud Environment modes per task.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <p>
          Every cmux task runs inside an isolated workspace. The mode you pick
          determines where containers live, what resources they can reach, and
          how artifacts are persisted.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <ModeCard
            title="Local Docker"
            description="Runs containers on your machine. Ideal for fast iteration with access to your local filesystem mounts."
            bullets={[
              "Requires Docker Desktop or Colima",
              "Streams VS Code and terminal over the local bridge",
              "Artifacts stored under ~/cmux",
            ]}
            icon={Server}
          />
          <ModeCard
            title="Cloud"
            description="Spin up ephemeral workers in cmux Cloud for heavy builds or when you need consistent GPU/CPU profiles."
            bullets={[
              "Bring-your-own AWS or GCP account",
              "Secrets injected via Vault",
              "Auto-shutdown after inactivity",
            ]}
            icon={Cloud}
          />
          <ModeCard
            title="Cloud Environment"
            description="Attach cmux to an always-on environment (staging, preview, or customer sandbox) and stream agent work there."
            bullets={[
              "Uses persistent volumes",
              "Supports shared databases and feature flags",
              "Great for regression triage",
            ]}
            icon={Workflow}
          />
        </div>
        <p>
          Switch modes directly within the Task Composer. cmux will run a
          compatibility scan and flag missing secrets, blocked ports, or
          dependency mismatches before launch.
        </p>
        <PlaceholderCard
          icon={Video}
          label="Mode comparison demo"
          description="TODO: Record a clip that shows swapping modes and the live readiness checklist updating in real time."
        />
      </div>
    ),
  },
  {
    id: "repositories",
    eyebrow: "Code access",
    title: "Connect repositories and branches",
    summary: "Workspaces stay clean when clone rules and branch policies are explicit.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <ol className="list-decimal space-y-3 pl-6">
          <li>
            Navigate to <span className="font-medium text-white">Repos</span>
            {" -> "}
            <span className="font-medium text-white">New connection</span>.
            Choose a provider, select the repository, and decide whether to track
            the default branch or a feature branch.
          </li>
          <li>
            Configure clone depth and optional sparse checkout rules to avoid
            fetching unnecessary history or monorepo packages.
          </li>
          <li>
            Add branch protection notes so agents know when to open PRs vs. when
            to ship directly.
          </li>
        </ol>
        <CalloutCard
          icon={GitBranch}
          title="Live sync"
          description="cmux syncs commits back to origin under bot identities you control, and always attaches diffs to the originating task."
        />
        <PlaceholderCard
          icon={Camera}
          label="Repository picker screenshot"
          description="TODO: Show the repo selection modal with branch and sparse checkout options highlighted."
        />
      </div>
    ),
  },
  {
    id: "environments",
    eyebrow: "Context",
    title: "Set up environment blueprints",
    summary: "Codify runtime dependencies so every agent workspace is self-healing.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <p>
          Environments bundle Docker base images, dependency setup commands, and
          secret groups. Reuse them across tasks to guarantee reproducibility.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard
            title="Blueprint parameters"
            description="Specify base image, health checks, default services (databases, message queues), and warmup scripts."
            icon={Boxes}
          />
          <FeatureCard
            title="Secret groups"
            description="Group API keys, tokens, and credentials; reference them by name in tasks so rotations are centralized."
            icon={ShieldCheck}
          />
        </div>
        <ol className="list-decimal space-y-3 pl-6">
          <li>
            Go to Settings{" -> "}Environments{" -> "}
            <span className="font-medium text-white">New blueprint</span>.
          </li>
          <li>
            Attach secret groups and configure automatic retries for flaky setup
            commands.
          </li>
          <li>
            Run <span className="font-medium text-white">Validate blueprint</span> to launch a dry-run container and export logs.
          </li>
        </ol>
        <PlaceholderCard
          icon={Video}
          label="Blueprint validation clip"
          description="TODO: Record validation output showing dependency install, health checks, and resulting success badge."
        />
      </div>
    ),
  },
  {
    id: "api-keys",
    eyebrow: "Access",
    title: "Configure provider API keys",
    summary: "Keep secrets centralized and scoped to the least privilege necessary.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <p>
          Add provider credentials once and re-use them across agents. cmux never
          stores raw keys in plain text - everything is wrapped in KMS-managed
          vaults.
        </p>
        <ol className="list-decimal space-y-3 pl-6">
          <li>
            Settings{" -> "}Credentials{" -> "}
            <span className="font-medium text-white">Add key</span>.
          </li>
          <li>
            Paste the key, label it (e.g., <em>Claude-production</em>), and
            scope it to workspaces or teams.
          </li>
          <li>
            Enable usage quotas and alerting so you know when spend drifts.
          </li>
        </ol>
        <CalloutCard
          icon={KeyRound}
          title="Rotation friendly"
          description="Swap a key once in Credentials and every agent referencing that label updates instantly - no task edits required."
        />
        <PlaceholderCard
          icon={Camera}
          label="Credentials form screenshot"
          description="TODO: Capture the add-key modal with scopes, alerts, and audit logs annotated."
        />
      </div>
    ),
  },
  {
    id: "tasks",
    eyebrow: "Execution",
    title: "Launch a task and monitor progress",
    summary: "Follow this choreography each time you dispatch work to the agent squad.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <ol className="list-decimal space-y-4 pl-6">
          <li>
            Open the Task Composer, name your mission, and paste context (ticket
            links, acceptance criteria, code references).
          </li>
          <li>
            Assign agents, select execution mode, attach environment blueprints,
            and decide whether human approval is required before merge.
          </li>
          <li>
            Hit <span className="font-medium text-white">Launch</span>. cmux will spin up workspaces, stream logs, and display per-agent status.
          </li>
        </ol>
        <PlaceholderCard
          icon={Video}
          label="Task launch walkthrough"
          description="TODO: Add a motion clip showing the Task Composer filling out, the readiness checklist, and the launch confirmation toast."
        />
        <CalloutCard
          icon={Play}
          title="Live controls"
          description="Pause, resume, or nudge agents mid-run. Inject hints, rerun tests, or request fresh diffs without abandoning the task."
        />
      </div>
    ),
  },
  {
    id: "workspaces",
    eyebrow: "Review",
    title: "Understand each agent workspace",
    summary: "The Split View keeps diffs, terminals, and evaluations tightly coupled.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard
            title="Diff lane"
            description="Every file change is contextualized with inline AI explanations and test annotations." 
            icon={ScanEye}
          />
          <FeatureCard
            title="Terminal playback"
            description="Scrub through terminal output with timestamped checkpoints - perfect for debugging failing commands."
            icon={Activity}
          />
        </div>
        <PlaceholderCard
          icon={Camera}
          label="Workspace overview screenshot"
          description="TODO: Include a composite screenshot calling out the diff lane, terminal scrubber, and agent summary panel."
        />
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5">
          <h3 className="text-sm font-semibold text-white">Spot checks</h3>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            <li>Confirm the agent summary aligns with actual diffs and test results.</li>
            <li>Use <code>Copy Patch</code> to lift changes into your local repo if you prefer manual merges.</li>
            <li>Mark items as <em>Needs revision</em> to loop feedback back into the agent conversation.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "observability",
    eyebrow: "Governance",
    title: "Track progress, governance, and audit trails",
    summary: "Everything agents do is captured for compliance and retros.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <p>
          Visit the Task Timeline to replay decisions, prompts, and diffs. This
          audit layer keeps humans in control even when multiple tasks run in
          parallel.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard
            title="Timeline filters"
            description="Zero in on prompt edits, code executions, or imports of external packages." 
            icon={ClipboardList}
          />
          <FeatureCard
            title="Exportable logs"
            description="Send the full trace to your SIEM or attach it to incident reports with one click."
            icon={ShieldCheck}
          />
        </div>
        <PlaceholderCard
          icon={Camera}
          label="Timeline screenshot"
          description="TODO: Highlight filters, event stack, and export button."
        />
      </div>
    ),
  },
  {
    id: "next-steps",
    eyebrow: "Go further",
    title: "Ritualize cmux inside your team",
    summary: "Keep iterating so agents level up alongside your engineering practice.",
    content: (
      <div className="space-y-6 text-sm leading-relaxed text-neutral-300">
        <ul className="space-y-3 list-disc pl-5">
          <li>Codify review expectations in shared templates inside the Task Composer.</li>
          <li>Schedule weekly triage to prune agent libraries that underperform.</li>
          <li>Connect cmux webhooks to your chat tool for real-time task status pings.</li>
        </ul>
        <PlaceholderCard
          icon={Video}
          label="Team onboarding session"
          description="TODO: Slot in a recorded internal enablement session or customer workshop."
        />
        <CalloutCard
          icon={Sparkles}
          title="Share feedback"
          description="Drop ideas in #feedback or book time with the cmux team. We ship improvements weekly."
        />
      </div>
    ),
  },
];

const sidebarSections = sections.map(({ id, title }) => ({ id, title }));

const resourceCards = [
  {
    title: "Release notes",
    description: "Track what shipped this week so you can update internal docs fast.",
    href: "/#roadmap",
  },
  {
    title: "Community Discord",
    description: "Swap playbooks with other high-agency cmux teams.",
    href: "https://discord.gg/cmux",
  },
  {
    title: "Request migration help",
    description: "Bring legacy scripts or internal agents and we will help you port them.",
    href: "https://cal.com/team/manaflow/meeting",
  },
];

export default function TutorialPage() {
  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-500/10 via-background to-background blur-3xl" aria-hidden></div>
      <header className="relative border-b border-neutral-900 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-neutral-500">
            <ArrowLeft className="h-4 w-4 text-neutral-600" aria-hidden />
            <Link href="/" className="font-semibold text-neutral-400 hover:text-white">
              Back to cmux.home
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
              <BookOpen className="h-5 w-5" aria-hidden />
              <span>cmux tutorial</span>
            </div>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl md:text-5xl">
              Ship faster with disciplined multi-agent workflows
            </h1>
            <p className="max-w-2xl text-base text-neutral-300 sm:text-lg">
              {pageSubtitle}
            </p>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-6xl gap-8 px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <TutorialSidebar sections={sidebarSections} />
        <article className="flex-1 space-y-20">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-32 space-y-6 rounded-2xl border border-neutral-900 bg-neutral-950/60 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)] lg:p-8"
            >
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
                  {section.eyebrow}
                </span>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                  {section.title}
                </h2>
                <p className="max-w-2xl text-sm text-neutral-400 sm:text-base">
                  {section.summary}
                </p>
              </div>
              {section.content}
            </section>
          ))}
        </article>
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-2xl border border-neutral-900 bg-neutral-950/80 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Quick resources
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-neutral-300">
                {resourceCards.map((resource) => (
                  <li key={resource.title}>
                    <a
                      href={resource.href}
                      className="group block rounded-lg border border-transparent bg-neutral-900/60 p-3 transition hover:border-blue-500/60 hover:bg-neutral-900/90"
                      target={resource.href.startsWith("http") ? "_blank" : undefined}
                      rel={resource.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      <p className="font-semibold text-white group-hover:text-blue-200">
                        {resource.title}
                      </p>
                      <p className="mt-1 text-xs text-neutral-400">{resource.description}</p>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-neutral-900 bg-neutral-950/80 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Session checklist
              </h3>
              <ol className="mt-4 space-y-3 text-xs text-neutral-300">
                <li className="flex gap-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full border border-neutral-700 text-center text-[10px] leading-5">
                    1
                  </span>
                  Review prerequisites and connect git providers.
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full border border-neutral-700 text-center text-[10px] leading-5">
                    2
                  </span>
                  Configure agents, execution mode, and environment blueprint.
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 h-5 w-5 rounded-full border border-neutral-700 text-center text-[10px] leading-5">
                    3
                  </span>
                  Launch a task, inspect diffs, and export the audit trail.
                </li>
              </ol>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

type CalloutCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

function CalloutCard({ icon: Icon, title, description }: CalloutCardProps) {
  return (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950/70 p-5 shadow-[0_10px_40px_-30px_rgba(59,130,246,0.6)]">
      <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
        <Icon className="h-4 w-4" aria-hidden />
        <span>{title}</span>
      </div>
      <p className="mt-3 text-xs text-neutral-400 sm:text-sm">{description}</p>
    </div>
  );
}

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-300">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <p className="mt-3 text-xs text-neutral-400 sm:text-sm">{description}</p>
    </div>
  );
}

type ModeCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
};

function ModeCard({ icon: Icon, title, description, bullets }: ModeCardProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-neutral-900 bg-neutral-950/60 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-300">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <p className="text-xs text-neutral-400 sm:text-sm">{description}</p>
      <ul className="mt-4 space-y-2 text-xs text-neutral-400">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-blue-400" aria-hidden></span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PlaceholderCardProps = {
  icon: LucideIcon;
  label: string;
  description: string;
};

function PlaceholderCard({ icon: Icon, label, description }: PlaceholderCardProps) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/40 p-5">
      <div className="flex items-center gap-3 text-sm font-semibold text-neutral-200">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
          <Icon className="h-5 w-5 text-neutral-400" aria-hidden />
        </div>
        <span>{label}</span>
      </div>
      <p className="mt-2 text-xs text-neutral-500 sm:text-sm">{description}</p>
    </div>
  );
}
