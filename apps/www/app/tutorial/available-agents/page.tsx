import { Bot, Code2, Sparkles, Zap } from "lucide-react";
import { Callout } from "@/components/tutorial/Callout";
import { MediaPlaceholder } from "@/components/tutorial/MediaPlaceholder";
import { TutorialLayout } from "@/components/tutorial/TutorialLayout";
import { tutorialSections } from "@/lib/tutorial-config";

export default function AvailableAgentsPage() {
  return (
    <TutorialLayout sections={tutorialSections}>
      <article className="prose prose-invert max-w-none">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white mb-0">Available Agents</h1>
            <p className="text-lg text-neutral-400">
              cmux supports multiple AI coding agents. Each agent has unique strengths and capabilities.
            </p>
          </div>

          <MediaPlaceholder
            type="image"
            description="Screenshot of the agent selection interface in cmux dashboard"
          />

          {/* Agent List */}
          <div className="pt-4">
            <h2 className="text-2xl font-semibold text-white mb-6">Supported Agents</h2>

            <div className="space-y-6">
              {/* Claude Code */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">Claude Code</h3>
                      <p className="text-sm text-neutral-500">by Anthropic</p>
                    </div>
                    <p className="text-neutral-400">
                      Claude Code is Anthropic&apos;s official CLI for Claude. It excels at complex refactoring,
                      architecture design, and understanding large codebases. Best for tasks requiring deep
                      reasoning and careful consideration.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                        Complex Refactoring
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                        Architecture Design
                      </span>
                      <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
                        Code Understanding
                      </span>
                    </div>
                    <div className="pt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500">API Key Required:</span>
                        <code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">ANTHROPIC_API_KEY</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500">Documentation:</span>
                        <a href="https://docs.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                          docs.anthropic.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Codex */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Code2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">Codex CLI</h3>
                      <p className="text-sm text-neutral-500">by OpenAI</p>
                    </div>
                    <p className="text-neutral-400">
                      OpenAI&apos;s Codex CLI is fast and efficient for code generation and completion.
                      Excellent for writing boilerplate, generating tests, and quick iterations.
                      Works well with natural language prompts.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                        Code Generation
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                        Test Writing
                      </span>
                      <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium">
                        Fast Iterations
                      </span>
                    </div>
                    <div className="pt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500">API Key Required:</span>
                        <code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">OPENAI_API_KEY</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500">Documentation:</span>
                        <a href="https://platform.openai.com/docs" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                          platform.openai.com/docs
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gemini CLI */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-orange-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">Gemini CLI</h3>
                      <p className="text-sm text-neutral-500">by Google</p>
                    </div>
                    <p className="text-neutral-400">
                      Google&apos;s Gemini CLI offers strong multimodal capabilities and code understanding.
                      Great for documentation, explaining complex code, and working with multiple file formats.
                      Excels at context-aware suggestions.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                        Documentation
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                        Code Explanation
                      </span>
                      <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
                        Multimodal
                      </span>
                    </div>
                    <div className="pt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500">API Key Required:</span>
                        <code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">GOOGLE_API_KEY</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500">Documentation:</span>
                        <a href="https://ai.google.dev/docs" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                          ai.google.dev/docs
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amp */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">Amp</h3>
                      <p className="text-sm text-neutral-500">Community</p>
                    </div>
                    <p className="text-neutral-400">
                      Amp is a lightweight, fast agent focused on quick edits and small changes.
                      Perfect for fixing bugs, making minor adjustments, and rapid prototyping.
                      Low latency makes it ideal for interactive sessions.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                        Bug Fixes
                      </span>
                      <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium">
                        Quick Edits
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                        Low Latency
                      </span>
                    </div>
                    <div className="pt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500">Configuration:</span>
                        <span className="text-neutral-400">Uses provider API keys</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Opencode */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Code2 className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-1">Opencode</h3>
                      <p className="text-sm text-neutral-500">Community</p>
                    </div>
                    <p className="text-neutral-400">
                      Opencode is an open-source coding agent with customizable behavior.
                      Great for experimentation, custom workflows, and integrating with specific toolchains.
                      Highly extensible and transparent.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                        Open Source
                      </span>
                      <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
                        Customizable
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                        Extensible
                      </span>
                    </div>
                    <div className="pt-2 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500">Configuration:</span>
                        <span className="text-neutral-400">Flexible setup</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How to Select */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Selecting Agents in cmux
            </h2>

            <p className="text-neutral-400 mb-6">
              When creating a new task, you can select which agent(s) to use:
            </p>

            <MediaPlaceholder
              type="image"
              description="Screenshot showing the agent selection dropdown in the task creation interface"
            />

            <div className="mt-6 space-y-4">
              <Callout type="tip" title="Pro Tip: Run Multiple Agents">
                <p>
                  You can run the same task with multiple agents simultaneously to compare results.
                  This is useful when you&apos;re not sure which agent will perform best for your specific task.
                </p>
              </Callout>

              <Callout type="info" title="Agent Performance Varies">
                <p>
                  Agent performance can vary based on task complexity, codebase size, and specific requirements.
                  Experiment with different agents to find what works best for your workflow.
                </p>
              </Callout>
            </div>
          </div>

          {/* Next Steps */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">Next Steps</h2>
            <div className="grid gap-3">
              <a
                href="/tutorial/choosing-agents"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Choosing the Right Agent →</div>
                <div className="text-sm text-neutral-400">
                  Learn how to select the best agent for different types of tasks
                </div>
              </a>
              <a
                href="/tutorial/api-keys"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Configure API Keys →</div>
                <div className="text-sm text-neutral-400">
                  Set up authentication for each agent provider
                </div>
              </a>
            </div>
          </div>
        </div>
      </article>
    </TutorialLayout>
  );
}
