import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Cpu,
  Layers3,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type TutorialStep = {
  id: string;
  title: string;
  description: string;
  callouts?: string[];
  placeholders?: string[];
};

type TutorialSection = {
  id: string;
  title: string;
  intro: string;
  steps: TutorialStep[];
  resources?: string[];
};

const tutorialSections: TutorialSection[] = [
  {
    id: "orientation",
    title: "Get oriented",
    intro:
      "Understand the cmux workspace, vocabulary, and how the agent command center fits into your development cadence.",
    steps: [
      {
        id: "workspace-tour",
        title: "Tour the workspace",
        description:
          "The global sidebar keeps quick access to tasks, environments, and settings. The canvas shows active runs with snapshots, verification cards, and terminal multiplexers.",
        callouts: [
          "Home surfaces every running agent with health, diff status, and reviewer assignment.",
          "Timeline view stitches prompts, model responses, and manual notes into one audit trail.",
          "Command palette (⌘K) jumps across runs, opens VS Code capsules, or starts new tasks instantly.",
        ],
        placeholders: [
          "Screenshot placeholder: cmux workspace layout",
          "Video placeholder: 90-second UI flythrough",
        ],
      },
      {
        id: "roles",
        title: "Know your roles",
        description:
          "Every run distinguishes operators, reviewers, observers, and agent personas so accountability stays crisp.",
        callouts: [
          "Operators launch and steer runs, adjusting prompts or autonomy in real-time.",
          "Reviewers receive diff bundles, verification checklists, and approval controls.",
          "Observers can follow along silently — ideal for stakeholders or pairing engineers.",
        ],
        placeholders: [
          "Diagram placeholder: Role permissions matrix",
          "Text placeholder: Suggested review cadence",
        ],
      },
    ],
    resources: [
      "Placeholder: Link to onboarding deck",
      "Placeholder: Link to workspace keyboard shortcuts",
    ],
  },
  {
    id: "repositories",
    title: "Connect repositories",
    intro:
      "cmux works with GitHub, GitLab, and direct archives. Bring repositories in with branch policies and verification defaults.",
    steps: [
      {
        id: "import",
        title: "Add a repository",
        description:
          "Select \"Add repo\" from the sidebar. Authenticate with OAuth or drop in deploy keys. Choose read-only for experimentation or write access for automated PRs.",
        callouts: [
          "Supports monorepos with sub-directory scoping per task.",
          "Branch protections can auto-create feature branches using your naming schema.",
          "Set default reviewers so every run has human oversight before merge.",
        ],
        placeholders: [
          "Screenshot placeholder: Repository import modal",
          "Text placeholder: Example branch naming conventions",
        ],
      },
      {
        id: "sync",
        title: "Sync source and dependencies",
        description:
          "Choose whether cmux clones full history or shallow copies. Configure dependency install hooks (npm, pnpm, poetry, cargo) that run inside every container.",
        callouts: [
          "Cache warmers let you pre-bake Docker layers with dependencies for faster spins.",
          "Optional yolo mode uses snapshot commits for throwaway experiments.",
          "Attach secrets or environment templates specific to the repository.",
        ],
        placeholders: [
          "Screenshot placeholder: Dependency hook editor",
          "Diagram placeholder: Cached container layers",
        ],
      },
    ],
    resources: [
      "Placeholder: Checklist PDF for repo readiness",
      "Placeholder: Script snippet for pre-build hooks",
    ],
  },
  {
    id: "agents",
    title: "Select and configure agents",
    intro:
      "Blend foundation models, internal copilots, or specialized tool-runners. Profiles encapsulate prompt templates, capabilities, and guardrails.",
    steps: [
      {
        id: "catalog",
        title: "Browse the agent catalog",
        description:
          "Use filters for language expertise, refactor strength, documentation skills, or alignment level. Each agent card shows cost, latency, and historical quality score.",
        callouts: [
          "Claude Code, Codex, Gemini CLI, and custom gRPC agents all live in the same directory.",
          "Capability tags (\"tests\", \"infra\", \"frontend\") inform automatic routing recommendations.",
          "Compare sandbox vs high-autonomy personas before assigning to production-critical tasks.",
        ],
        placeholders: [
          "Screenshot placeholder: Agent catalog grid",
          "Text placeholder: Capability comparison table",
        ],
      },
      {
        id: "profiles",
        title: "Tune agent profiles",
        description:
          "Adjust temperature, context window, tooling access, and safety rails per run. Attach prompt primers, coding standards, or definition-of-done snippets.",
        callouts: [
          "Mode presets (Exploratory, Structured, Locked) map to autonomy levels.",
          "Prompt layers can inject architecture docs or component diagrams automatically.",
          "Guardrails restrict commands, directories, or API usage for sensitive repos.",
        ],
        placeholders: [
          "Screenshot placeholder: Agent profile editor",
          "Video placeholder: Prompt layering demo",
        ],
      },
    ],
    resources: [
      "Placeholder: CSV export of agent performance benchmarks",
      "Placeholder: Link to agent marketplace submission form",
    ],
  },
  {
    id: "modes",
    title: "Choose execution modes",
    intro:
      "Switch between local Docker, managed cloud, or bring-your-own infrastructure depending on compliance and scale.",
    steps: [
      {
        id: "local",
        title: "Local Docker",
        description:
          "Ideal for iterative work. cmux launches ephemeral containers on your machine, mounts the repo, and opens a dedicated VS Code window per agent.",
        callouts: [
          "Great for low-latency debugging with local databases or services.",
          "Supports GPU passthrough if your laptop or workstation has available resources.",
          "Offline mode caches model responses for replay once reconnected.",
        ],
        placeholders: [
          "Screenshot placeholder: Local mode configuration",
          "Diagram placeholder: Local network architecture",
        ],
      },
      {
        id: "managed",
        title: "Managed cloud",
        description:
          "Launch agents in cmux-managed infrastructure. Autoscale based on queue length, mirror logs back in real time, and archive runs for compliance.",
        callouts: [
          "Regions in US, EU, and APAC with data residency controls.",
          "Role-based access determines who can view logs or pull artifacts.",
          "One-click escalation into human-assisted pair programming mode.",
        ],
        placeholders: [
          "Screenshot placeholder: Cloud region selector",
          "Video placeholder: Autoscaling dashboard tour",
        ],
      },
      {
        id: "byo",
        title: "Bring your own environment",
        description:
          "Connect cmux to Kubernetes, ECS, Render, or bare metal. We deploy agents into your network while respecting your IAM and secrets policies.",
        callouts: [
          "Supports sealed secrets, HashiCorp Vault, or Doppler for key delivery.",
          "Network policies ensure agents only touch resources you authorize.",
          "Observability adapters stream traces into Datadog, New Relic, or OpenTelemetry.",
        ],
        placeholders: [
          "Diagram placeholder: BYO networking flow",
          "Text placeholder: Terraform module link",
        ],
      },
    ],
    resources: [
      "Placeholder: Security whitepaper download",
      "Placeholder: Link to infrastructure terraform modules",
    ],
  },
  {
    id: "environments",
    title: "Set up environments",
    intro:
      "Templates define how containers boot, what secrets they inherit, and which health checks must pass before agents work.",
    steps: [
      {
        id: "templates",
        title: "Create environment templates",
        description:
          "Choose a base image (Ubuntu, Alpine, custom) and specify provisioning scripts. Layer runtime packages, CLI tools, and dataset mounts.",
        callouts: [
          "Version templates so agents on long-running tasks stay stable.",
          "Attach readiness checks (tests, migrations, smoke scripts).",
          "Inject environment variables via sealed secrets or secret managers.",
        ],
        placeholders: [
          "Screenshot placeholder: Environment template editor",
          "Text placeholder: Example provisioning script",
        ],
      },
      {
        id: "overrides",
        title: "Apply overrides per task",
        description:
          "Override runtime packages, compute levels, or network access on a per-run basis without cloning the template.",
        callouts: [
          "Emergency fix mode grants direct shell access with audit logging.",
          "Sandbox toggle enables read-only filesystem for exploratory runs.",
          "Resource caps prevent runaway CPU or memory usage.",
        ],
        placeholders: [
          "Screenshot placeholder: Task-level environment override",
          "Video placeholder: Live swap between templates",
        ],
      },
    ],
    resources: [
      "Placeholder: YAML schema reference",
      "Placeholder: Link to example Dockerfiles",
    ],
  },
  {
    id: "api-keys",
    title: "Configure API keys & integrations",
    intro:
      "Centralize model keys, repository tokens, and integration secrets with lifecycle controls.",
    steps: [
      {
        id: "vault",
        title: "Store keys securely",
        description:
          "Use the Settings → Credentials panel. Keys are encrypted with your org's KMS and scoped to teams or projects.",
        callouts: [
          "Supports OpenAI, Anthropic, Google, Azure, and custom endpoints.",
          "Rotate or revoke keys with immediate propagation to active agents.",
          "Service accounts can hold lower-privilege keys for staging environments.",
        ],
        placeholders: [
          "Screenshot placeholder: API key vault",
          "Text placeholder: Secret rotation checklist",
        ],
      },
      {
        id: "integrations",
        title: "Wire up integrations",
        description:
          "Connect Slack, Teams, PagerDuty, Jira, Linear, or Notion for status updates and ticket sync.",
        callouts: [
          "Alerting policies trigger on failed verification or long-running tasks.",
          "Ticket sync can auto-attach diff summaries and review notes.",
          "Webhook endpoints let you extend with internal automations.",
        ],
        placeholders: [
          "Screenshot placeholder: Integration gallery",
          "Video placeholder: Slack notification demo",
        ],
      },
    ],
    resources: [
      "Placeholder: Link to security & compliance FAQ",
      "Placeholder: Integration webhook reference",
    ],
  },
  {
    id: "tasks",
    title: "Launch and manage tasks",
    intro:
      "Translate product briefs into executable agent workstreams with guardrails.",
    steps: [
      {
        id: "briefs",
        title: "Author task briefs",
        description:
          "Structure the problem statement, acceptance criteria, and dependencies. Attach design docs or Loom walkthroughs.",
        callouts: [
          "Templates help standardize definitions of done per team.",
          "Embed code snippets or API schemas for quick reference.",
          "Assign reviewers and observers before launch so accountability is clear.",
        ],
        placeholders: [
          "Screenshot placeholder: Task brief editor",
          "Text placeholder: Example acceptance criteria",
        ],
      },
      {
        id: "launch",
        title: "Start the run",
        description:
          "Pick agents, execution mode, environment, and repo branch. Preview diffs cmux expects agents to touch and confirm before launching.",
        callouts: [
          "Trigger preflight checks to ensure dependencies, credentials, and environment readiness.",
          "Set autonomy level: step-by-step, collaborative, or fully autonomous.",
          "Configure guard timers and escalation paths if progress stalls.",
        ],
        placeholders: [
          "Video placeholder: Launch wizard walkthrough",
          "Text placeholder: Guard timer best practices",
        ],
      },
      {
        id: "monitor",
        title: "Monitor live activity",
        description:
          "Watch logs, diff progress, and telemetry cards per agent. Add inline notes or prompt nudges as they work.",
        callouts: [
          "Timeline shows prompt revisions and code checkpoints.",
          "Highlight blockers that require human intervention.",
          "Pause or swap agents without losing the task context.",
        ],
        placeholders: [
          "Screenshot placeholder: Live task monitoring",
          "Video placeholder: Prompt nudge in action",
        ],
      },
    ],
    resources: [
      "Placeholder: Task launch checklist PDF",
      "Placeholder: Link to autonomy tuning guide",
    ],
  },
  {
    id: "agent-console",
    title: "Interpret agent consoles",
    intro:
      "Agent dashboards bring together terminal feeds, VS Code diffs, telemetry, and humans-in-the-loop signals.",
    steps: [
      {
        id: "terminal",
        title: "Terminal & commands",
        description:
          "Commands are grouped by category (install, build, test, custom). Filter noise, pin important logs, and export transcripts.",
        callouts: [
          "Command replay lets you rerun steps locally with the same context.",
          "Highlight errors to create follow-up tasks automatically.",
          "Audit trail captures who prompted or intervened and when.",
        ],
        placeholders: [
          "Screenshot placeholder: Command timeline",
          "Text placeholder: Suggested tagging taxonomy",
        ],
      },
      {
        id: "diffs",
        title: "Diff viewer",
        description:
          "Review file-by-file changes with annotations, inline comments, and test coverage overlays.",
        callouts: [
          "Toggle semantic diff or readability mode for large refactors.",
          "Snapshot button captures current state for async reviews.",
          "Link directly to VS Code capsule to continue manual edits.",
        ],
        placeholders: [
          "Screenshot placeholder: Agent diff viewer",
          "Video placeholder: Semantic diff walkthrough",
        ],
      },
      {
        id: "insights",
        title: "Insights & telemetry",
        description:
          "Metrics cards highlight test pass rates, coverage deltas, performance benchmarks, and artifact links.",
        callouts: [
          "Custom widgets pull in canary checks, load tests, or UX metrics.",
          "Badge system flags tasks that are ready for human review.",
          "Export insights to dashboards or documentation automatically.",
        ],
        placeholders: [
          "Screenshot placeholder: Insights cards",
          "Text placeholder: Metrics schema reference",
        ],
      },
    ],
    resources: [
      "Placeholder: Video deep dive on verification UI",
      "Placeholder: Link to telemetry integration examples",
    ],
  },
  {
    id: "verification",
    title: "Verify, approve, and ship",
    intro:
      "Move from AI output to production-ready code with structured human oversight.",
    steps: [
      {
        id: "checklists",
        title: "Work through verification checklists",
        description:
          "cmux auto-generates criteria from your templates. Mark items as you validate tests, security scans, documentation, and QA steps.",
        callouts: [
          "Attach supporting artifacts (videos, console logs, screenshots).",
          "Request rework with contextual prompts that agent personas understand.",
          "Invite peers for spot checks with shareable review links.",
        ],
        placeholders: [
          "Screenshot placeholder: Verification checklist",
          "Video placeholder: Requesting rework flow",
        ],
      },
      {
        id: "handoff",
        title: "Promote to PR or deployment",
        description:
          "Push branches, open pull requests, or trigger CI/CD pipelines directly. cmux packages diff summaries and approval notes automatically.",
        callouts: [
          "Supports GitHub, GitLab, Bitbucket, and custom git remotes.",
          "Attach release notes or migration guides as part of the handoff.",
          "Archive run artifacts to satisfy audit and compliance requirements.",
        ],
        placeholders: [
          "Screenshot placeholder: Handoff modal",
          "Text placeholder: Release notes template",
        ],
      },
      {
        id: "retros",
        title: "Capture learnings",
        description:
          "Tag successes, blockers, or regressions. Feed insights back into agent prompts, environment templates, or team rituals.",
        callouts: [
          "Quality scores feed the agent leaderboard.",
          "Auto-create follow-up tickets for manual cleanup.",
          "Share recaps in Slack, Notion, or email with one click.",
        ],
        placeholders: [
          "Screenshot placeholder: Retrospective summary",
          "Video placeholder: Publishing recap",
        ],
      },
    ],
    resources: [
      "Placeholder: Retrospective template",
      "Placeholder: Link to compliance configuration",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting & support",
    intro:
      "Keep the team unblocked with quick diagnostics and escalation paths.",
    steps: [
      {
        id: "diagnostics",
        title: "Run diagnostics",
        description:
          "Use the diagnostics panel to inspect container health, agent latency, and integration failures.",
        callouts: [
          "Download bundles with logs, prompts, and environment metadata for support.",
          "Smart suggestions surface common fixes (regenerate credentials, retry migrations).",
          "Status webhooks inform your incident channels automatically.",
        ],
        placeholders: [
          "Screenshot placeholder: Diagnostics panel",
          "Text placeholder: Incident response playbook",
        ],
      },
      {
        id: "support",
        title: "Engage support or community",
        description:
          "Open a ticket with manaflow, jump into the cmux Discord, or schedule a pairing session directly from the product.",
        callouts: [
          "Enterprise SLAs surface priority channels.",
          "Community Discord has topic-based rooms for agents, environments, and prompt design.",
          "Snapshots can be shared safely with redacted secrets.",
        ],
        placeholders: [
          "Screenshot placeholder: Support drawer",
          "Video placeholder: Filing a support ticket",
        ],
      },
    ],
    resources: [
      "Placeholder: Status page link",
      "Placeholder: Support escalation matrix",
    ],
  },
];

export const metadata: Metadata = {
  title: "cmux tutorial — orchestrate, verify, and ship with multi-agent precision",
  description:
    "Detailed tutorial for cmux covering repository setup, agent selection, execution modes, environment templates, API keys, task launch, agent consoles, and verification best practices.",
};

function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/5 px-4 py-3 text-xs text-neutral-300">
      {label}
    </div>
  );
}

export default function TutorialPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#030712] text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-20%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-sky-500/30 via-purple-500/20 to-transparent blur-[160px]" />
        <div className="absolute right-[-15%] top-[20%] h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-blue-500/20 via-cyan-400/15 to-transparent blur-[180px]" />
        <div className="absolute inset-x-[10%] bottom-[-25%] h-[36rem] rounded-full bg-gradient-to-tl from-sky-500/20 to-transparent blur-[200px]" />
      </div>

      <header className="border-b border-white/10 bg-black/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.3em] text-neutral-300">
            cmux tutorial
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold text-white sm:text-5xl">
              Master the cmux workflow from intake to verification
            </h1>
            <p className="max-w-3xl text-sm text-neutral-300 sm:text-base">
              Use this playbook to set up repositories, choose agents, configure execution modes, and guide teams through verification-ready deployments. Each section includes placeholders for the assets you can drop in as you document your own processes.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
              href="/"
            >
              Back to landing
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
              href="https://cal.com/team/manaflow/meeting"
              rel="noopener noreferrer"
              target="_blank"
            >
              Schedule onboarding
              <PlayCircle className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-10 px-4 pb-24 pt-12 sm:px-6">
        <aside className="sticky top-28 hidden h-fit w-64 flex-none space-y-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300 lg:block">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
            <Compass className="h-3.5 w-3.5" aria-hidden />
            Contents
          </div>
          <nav className="space-y-3">
            {tutorialSections.map((section) => (
              <div key={section.id} className="space-y-1">
                <a className="block font-semibold text-white transition hover:text-sky-300" href={`#${section.id}`}>
                  {section.title}
                </a>
                <ul className="space-y-1.5 pl-3 text-xs text-neutral-400">
                  {section.steps.map((step) => (
                    <li key={`${section.id}-${step.id}`}>
                      <a className="transition hover:text-white" href={`#${section.id}-${step.id}`}>
                        {step.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 space-y-24">
          {tutorialSections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_120px_-40px_rgba(56,189,248,0.4)]">
                <div className="flex items-center gap-3">
                  <Layers3 className="h-5 w-5 text-sky-300" aria-hidden />
                  <h2 className="text-2xl font-semibold text-white sm:text-3xl">{section.title}</h2>
                </div>
                <p className="text-sm text-neutral-300 sm:text-base">{section.intro}</p>

                <div className="space-y-6">
                  {section.steps.map((step, index) => (
                    <article
                      key={step.id}
                      id={`${section.id}-${step.id}`}
                      className="rounded-2xl border border-white/10 bg-neutral-950/70 p-6"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                        <div className="flex w-10 items-start justify-center">
                          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-sky-400/30 bg-sky-500/10 text-sm font-semibold text-white">
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1 space-y-4">
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                            <p className="text-sm text-neutral-300">{step.description}</p>
                          </div>
                          {step.callouts && (
                            <ul className="space-y-2 text-sm text-neutral-300">
                              {step.callouts.map((callout) => (
                                <li key={callout} className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-sky-300" aria-hidden />
                                  <span>{callout}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {step.placeholders && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {step.placeholders.map((label) => (
                                <Placeholder key={label} label={label} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {section.resources && (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-neutral-950/70 p-5 text-xs text-neutral-300">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Sparkles className="h-4 w-4 text-sky-300" aria-hidden />
                      Future resources
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-neutral-300">
                      {section.resources.map((resource) => (
                        <li key={resource} className="flex items-center gap-2">
                          <Cpu className="h-3.5 w-3.5 text-sky-300" aria-hidden />
                          <span>{resource}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          ))}
        </main>
      </div>

      <footer className="border-t border-white/10 bg-black/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 text-sm text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-4 w-4 text-sky-300" aria-hidden />
              <span className="font-semibold">Need a guided deployment?</span>
            </div>
            <p>
              Our team can help design agent operating models, compliance reviews, and onboarding workshops.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
              href="https://cal.com/team/manaflow/meeting"
              rel="noopener noreferrer"
              target="_blank"
            >
              Talk to manaflow
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
              href="/"
            >
              Explore the landing page
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
