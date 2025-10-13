import { Play, Plus } from "lucide-react";
import { Callout } from "@/components/tutorial/Callout";
import { CodeBlock } from "@/components/tutorial/CodeBlock";
import { MediaPlaceholder } from "@/components/tutorial/MediaPlaceholder";
import { StepCard } from "@/components/tutorial/StepCard";
import { TutorialLayout } from "@/components/tutorial/TutorialLayout";
import { tutorialSections } from "@/lib/tutorial-config";

export default function CreatingTasksPage() {
  return (
    <TutorialLayout sections={tutorialSections}>
      <article className="prose prose-invert max-w-none">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white mb-0">Creating Tasks</h1>
            <p className="text-lg text-neutral-400">
              Learn how to create and configure tasks for AI coding agents in cmux.
            </p>
          </div>

          <MediaPlaceholder
            type="video"
            description="Video walkthrough: Creating your first task from start to finish"
          />

          {/* Quick Start */}
          <div className="pt-4">
            <h2 className="text-2xl font-semibold text-white mb-6">Quick Start</h2>

            <div className="space-y-0">
              <StepCard number={1} title="Open Task Creator">
                <p>
                  Click the <code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-sm">+ New Task</code>{" "}
                  button in the cmux dashboard, or press{" "}
                  <code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-sm">⌘ + N</code> (Mac) /{" "}
                  <code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-sm">Ctrl + N</code> (Windows/Linux).
                </p>

                <MediaPlaceholder
                  type="image"
                  description="Screenshot highlighting the New Task button in the dashboard"
                  height="h-64"
                />
              </StepCard>

              <StepCard number={2} title="Select Repository">
                <p>
                  Choose the repository you want the agent to work on. If this is your first time, you&apos;ll need to
                  add a repository first.
                </p>

                <MediaPlaceholder
                  type="image"
                  description="Screenshot of repository selection dropdown"
                  height="h-64"
                />

                <Callout type="tip" title="Adding Repositories">
                  <p>
                    Click &quot;Add Repository&quot; to connect a Git repo from GitHub, GitLab, or a local path.
                    See the <a href="/tutorial/adding-repos" className="text-blue-400 hover:underline">Adding Repositories</a> guide for details.
                  </p>
                </Callout>
              </StepCard>

              <StepCard number={3} title="Choose Agent & Mode">
                <p>
                  Select which AI agent to use (Claude Code, Codex, Gemini, etc.) and the execution mode
                  (Local Docker, Cloud Sandbox, or Cloud Environment).
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <MediaPlaceholder
                    type="image"
                    description="Screenshot of agent selection dropdown"
                    height="h-48"
                  />
                  <MediaPlaceholder
                    type="image"
                    description="Screenshot of execution mode selector"
                    height="h-48"
                  />
                </div>

                <Callout type="info">
                  <p>
                    Not sure which agent to pick? Start with <strong>Claude Code</strong> for complex tasks
                    or <strong>Codex</strong> for quick iterations. You can always run multiple agents
                    in parallel to compare results.
                  </p>
                </Callout>
              </StepCard>

              <StepCard number={4} title="Write Task Description">
                <p>
                  Describe what you want the agent to do. Be specific and include context, requirements,
                  and any constraints. Good prompts lead to better results.
                </p>

                <CodeBlock
                  code={`# Example: Good task description

Refactor the user authentication module to use JWT tokens instead of sessions.

Requirements:
- Keep existing API endpoints unchanged
- Add token refresh mechanism
- Write unit tests for token generation and validation
- Update documentation in README.md

Context:
- Auth code is in src/auth/
- Tests are in tests/auth/
- We're using Express.js and the 'jsonwebtoken' library`}
                  language="markdown"
                  title="Example task prompt"
                />

                <MediaPlaceholder
                  type="image"
                  description="Screenshot of the task description editor with syntax highlighting"
                />

                <Callout type="tip" title="Writing Effective Prompts">
                  <ul className="space-y-1 text-sm list-disc list-inside mt-2">
                    <li>Be specific about what to change and why</li>
                    <li>Include file paths and relevant code locations</li>
                    <li>Specify any coding standards or patterns to follow</li>
                    <li>Mention what NOT to change (if applicable)</li>
                    <li>List expected deliverables (code, tests, docs, etc.)</li>
                  </ul>
                </Callout>
              </StepCard>

              <StepCard number={5} title="Configure Options (Optional)">
                <p>
                  Expand &quot;Advanced Options&quot; to configure additional settings:
                </p>

                <ul className="text-sm text-neutral-400 space-y-2 list-disc list-inside">
                  <li><strong>Branch:</strong> Choose which git branch to work on (default: main/master)</li>
                  <li><strong>Environment Variables:</strong> Add custom env vars for this task</li>
                  <li><strong>Timeout:</strong> Set maximum execution time (default: 30 minutes)</li>
                  <li><strong>Auto-commit:</strong> Automatically commit changes when task completes</li>
                  <li><strong>Create PR:</strong> Automatically create a pull request with the changes</li>
                </ul>

                <MediaPlaceholder
                  type="image"
                  description="Screenshot of advanced task options panel"
                />
              </StepCard>

              <StepCard number={6} title="Start Task">
                <p>
                  Click <code className="px-2 py-0.5 rounded bg-blue-500 text-white text-sm">Start Task</code> to
                  begin execution. cmux will:
                </p>

                <ol className="text-sm text-neutral-400 space-y-1 list-decimal list-inside">
                  <li>Clone your repository into an isolated environment</li>
                  <li>Spin up a VS Code instance with git diff UI</li>
                  <li>Start the selected AI agent with your prompt</li>
                  <li>Stream real-time logs to your dashboard</li>
                </ol>

                <MediaPlaceholder
                  type="video"
                  description="Video showing task starting and environment provisioning"
                />

                <Callout type="success" title="Task Started!">
                  <p>
                    You&apos;ll be redirected to the task monitoring page where you can watch the agent work
                    in real-time. The VS Code instance will open automatically.
                  </p>
                </Callout>
              </StepCard>
            </div>
          </div>

          {/* Running Multiple Agents */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Running Multiple Agents in Parallel
            </h2>

            <p className="text-neutral-400 mb-6">
              One of cmux&apos;s most powerful features is the ability to run multiple agents on the same task
              simultaneously. This lets you compare approaches and choose the best solution.
            </p>

            <MediaPlaceholder
              type="image"
              description="Screenshot showing multiple agent selection for parallel execution"
            />

            <div className="mt-6 space-y-4">
              <p className="text-neutral-300 text-sm">
                To run multiple agents:
              </p>

              <ol className="text-sm text-neutral-400 space-y-2 list-decimal list-inside">
                <li>In the agent selector, check multiple agents instead of just one</li>
                <li>Click &quot;Start Task&quot; - cmux will create separate environments for each agent</li>
                <li>Monitor all agents from a unified dashboard view</li>
                <li>Compare results side-by-side when they complete</li>
              </ol>

              <Callout type="tip" title="When to Use Multiple Agents">
                <p>
                  Running multiple agents is useful when:
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
                  <li>You&apos;re unsure which agent will perform best</li>
                  <li>The task has multiple valid approaches</li>
                  <li>You want to compare different AI models</li>
                  <li>Speed is more important than cost (parallelism trades cost for time)</li>
                </ul>
              </Callout>
            </div>
          </div>

          {/* Task Templates */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">Task Templates</h2>

            <p className="text-neutral-400 mb-6">
              Save time by creating reusable task templates for common workflows:
            </p>

            <MediaPlaceholder
              type="image"
              description="Screenshot of task templates library"
            />

            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <h4 className="font-semibold text-white mb-2 text-sm">Creating a Template</h4>
                <p className="text-sm text-neutral-400">
                  After configuring a task, click &quot;Save as Template&quot; before starting.
                  Give it a name and description. Templates can be shared with your team.
                </p>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                <h4 className="font-semibold text-white mb-2 text-sm">Using a Template</h4>
                <p className="text-sm text-neutral-400">
                  Click &quot;From Template&quot; when creating a new task. Select your template,
                  customize if needed, and start the task.
                </p>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">Next Steps</h2>
            <div className="grid gap-3">
              <a
                href="/tutorial/dashboard"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Monitor Running Tasks →</div>
                <div className="text-sm text-neutral-400">
                  Learn how to watch agents work and review their output
                </div>
              </a>
              <a
                href="/tutorial/code-review"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Review Code Changes →</div>
                <div className="text-sm text-neutral-400">
                  Use cmux&apos;s built-in code review interface to verify agent work
                </div>
              </a>
              <a
                href="/tutorial/parallel-execution"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Advanced: Parallel Execution →</div>
                <div className="text-sm text-neutral-400">
                  Master running multiple tasks and agents simultaneously
                </div>
              </a>
            </div>
          </div>
        </div>
      </article>
    </TutorialLayout>
  );
}
