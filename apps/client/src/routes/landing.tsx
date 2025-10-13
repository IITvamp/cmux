import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Zap, Shield, GitBranch, Play, Eye } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/landing")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-800/50 bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-lg font-bold text-white">C</span>
              </div>
              <span className="text-xl font-bold text-white">cmux</span>
            </div>
            <div className="flex items-center gap-6">
              <Link
                to="/tutorial"
                className="text-sm font-medium text-neutral-300 transition-colors hover:text-white"
              >
                Documentation
              </Link>
              <Link
                to="/sign-in"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-all hover:bg-neutral-100"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-4 pb-32 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/50 px-4 py-2 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-neutral-300">
                Multi-Agent Orchestration Platform
              </span>
            </div>
            <h1 className="mb-6 bg-gradient-to-br from-white via-neutral-100 to-neutral-400 bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-7xl lg:text-8xl">
              Parallel AI Agents
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text">
                At Scale
              </span>
            </h1>
            <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-neutral-400 sm:text-xl">
              Run Claude Code, Codex CLI, Gemini CLI, and other AI coding agents in parallel across
              multiple isolated environments. Build faster with intelligent orchestration.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/sign-in"
                className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-4 text-base font-semibold text-white transition-all hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25"
              >
                Start Building
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/tutorial"
                className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/50 px-8 py-4 text-base font-semibold text-neutral-100 backdrop-blur-sm transition-all hover:border-neutral-600 hover:bg-neutral-800/50"
              >
                View Documentation
              </Link>
            </div>
          </div>

          {/* Hero Visual Placeholder */}
          <div className="relative mx-auto mt-20 max-w-6xl">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl">
              <div className="flex h-96 items-center justify-center">
                <div className="text-center">
                  <Play className="mx-auto mb-4 h-16 w-16 text-neutral-600" />
                  <p className="text-sm font-medium text-neutral-500">
                    [Hero Screenshot/Video Placeholder]
                  </p>
                  <p className="mt-2 text-xs text-neutral-600">
                    Show cmux dashboard with multiple agents running in parallel
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-4 py-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-white sm:text-5xl">
              Everything you need to scale AI development
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-neutral-400">
              Powerful features designed for teams building with AI coding agents
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-sm transition-all hover:border-neutral-700 hover:bg-neutral-800/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10">
                <Zap className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Multi-Agent Orchestration</h3>
              <p className="text-neutral-400">
                Run Claude Code, Codex, Gemini, Amp, and Opencode simultaneously across multiple
                tasks with intelligent load balancing.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-sm transition-all hover:border-neutral-700 hover:bg-neutral-800/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10">
                <Shield className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Isolated Environments</h3>
              <p className="text-neutral-400">
                Each task runs in its own Docker container or cloud environment with OpenVSCode,
                ensuring complete isolation and reproducibility.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-sm transition-all hover:border-neutral-700 hover:bg-neutral-800/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500/10 to-pink-600/10">
                <GitBranch className="h-6 w-6 text-pink-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Git Integration</h3>
              <p className="text-neutral-400">
                Built-in git diff viewer, branch management, and PR workflow integration. See
                changes in real-time as agents work.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-sm transition-all hover:border-neutral-700 hover:bg-neutral-800/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/10">
                <Eye className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Real-Time Monitoring</h3>
              <p className="text-neutral-400">
                Watch your agents work with live terminal output, file changes, and execution
                status. Full transparency into every action.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-sm transition-all hover:border-neutral-700 hover:bg-neutral-800/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-600/10">
                <Sparkles className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Flexible Deployment</h3>
              <p className="text-neutral-400">
                Choose between local Docker containers, cloud environments, or custom sandbox
                providers based on your needs.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-sm transition-all hover:border-neutral-700 hover:bg-neutral-800/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-600/10">
                <Zap className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Devcontainer Support</h3>
              <p className="text-neutral-400">
                Full support for devcontainer.json configuration. Customize your development
                environment with any tools and dependencies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-4 py-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20 p-12 backdrop-blur-xl sm:p-16">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10" />
            <div className="relative mx-auto max-w-3xl text-center">
              <h2 className="mb-6 text-4xl font-bold text-white sm:text-5xl">
                Ready to scale your AI development?
              </h2>
              <p className="mb-10 text-lg text-neutral-300">
                Join teams using cmux to orchestrate AI agents and ship faster than ever before.
              </p>
              <Link
                to="/sign-in"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-neutral-900 transition-all hover:scale-105 hover:shadow-2xl"
              >
                Get Started Now
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800/50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-lg font-bold text-white">C</span>
              </div>
              <span className="text-sm font-medium text-neutral-400">
                cmux - Multi-Agent Orchestration
              </span>
            </div>
            <div className="flex gap-6">
              <Link
                to="/tutorial"
                className="text-sm text-neutral-400 transition-colors hover:text-white"
              >
                Documentation
              </Link>
              <a
                href="https://github.com/manaflow-ai/cmux"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-neutral-400 transition-colors hover:text-white"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
