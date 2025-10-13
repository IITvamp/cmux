import type { TutorialSection } from "@/components/tutorial/TutorialSidebar";

export const tutorialSections: TutorialSection[] = [
  {
    title: "Introduction",
    slug: "introduction",
  },
  {
    title: "Getting Started",
    slug: "getting-started",
    subsections: [
      { title: "Installation", slug: "installation" },
      { title: "First Launch", slug: "first-launch" },
      { title: "System Requirements", slug: "requirements" },
    ],
  },
  {
    title: "Core Concepts",
    slug: "core-concepts",
    subsections: [
      { title: "Understanding cmux", slug: "understanding-cmux" },
      { title: "Agents Overview", slug: "agents-overview" },
      { title: "Sandboxes & Isolation", slug: "sandboxes" },
    ],
  },
  {
    title: "Selecting Agents",
    slug: "agents",
    subsections: [
      { title: "Available Agents", slug: "available-agents" },
      { title: "Choosing the Right Agent", slug: "choosing-agents" },
      { title: "Running Multiple Agents", slug: "multiple-agents" },
    ],
  },
  {
    title: "Execution Modes",
    slug: "modes",
    subsections: [
      { title: "Local Docker Mode", slug: "local-docker" },
      { title: "Cloud Sandbox Mode", slug: "cloud-sandbox" },
      { title: "Cloud Environment Mode", slug: "cloud-environment" },
      { title: "Comparing Modes", slug: "comparing-modes" },
    ],
  },
  {
    title: "Repository Management",
    slug: "repositories",
    subsections: [
      { title: "Adding Repositories", slug: "adding-repos" },
      { title: "Branch Management", slug: "branch-management" },
      { title: "Git Integration", slug: "git-integration" },
    ],
  },
  {
    title: "Environment Setup",
    slug: "environment",
    subsections: [
      { title: "Docker Configuration", slug: "docker-config" },
      { title: "DevContainer Setup", slug: "devcontainer" },
      { title: "Environment Variables", slug: "env-variables" },
      { title: "Custom Configurations", slug: "custom-configs" },
    ],
  },
  {
    title: "API Keys & Settings",
    slug: "settings",
    subsections: [
      { title: "Configuring API Keys", slug: "api-keys" },
      { title: "Anthropic (Claude)", slug: "anthropic-setup" },
      { title: "OpenAI (Codex)", slug: "openai-setup" },
      { title: "Google (Gemini)", slug: "google-setup" },
      { title: "Other Providers", slug: "other-providers" },
    ],
  },
  {
    title: "Task Management",
    slug: "tasks",
    subsections: [
      { title: "Creating Tasks", slug: "creating-tasks" },
      { title: "Task Queue", slug: "task-queue" },
      { title: "Parallel Execution", slug: "parallel-execution" },
      { title: "Task History", slug: "task-history" },
    ],
  },
  {
    title: "Monitoring Agents",
    slug: "monitoring",
    subsections: [
      { title: "Agent Dashboard", slug: "dashboard" },
      { title: "Viewing Logs", slug: "logs" },
      { title: "Code Review Interface", slug: "code-review" },
      { title: "VS Code Integration", slug: "vscode-integration" },
      { title: "Git Diff UI", slug: "git-diff" },
    ],
  },
  {
    title: "Advanced Features",
    slug: "advanced",
    subsections: [
      { title: "Custom Agent Configurations", slug: "custom-agents" },
      { title: "Workflow Automation", slug: "workflows" },
      { title: "Team Collaboration", slug: "collaboration" },
      { title: "Performance Optimization", slug: "performance" },
    ],
  },
  {
    title: "Troubleshooting",
    slug: "troubleshooting",
    subsections: [
      { title: "Common Issues", slug: "common-issues" },
      { title: "Docker Problems", slug: "docker-issues" },
      { title: "Agent Errors", slug: "agent-errors" },
      { title: "Getting Help", slug: "getting-help" },
    ],
  },
];
