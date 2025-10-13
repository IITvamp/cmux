import { Activity, Eye, GitBranch, Terminal } from "lucide-react";
import { Callout } from "@/components/tutorial/Callout";
import { MediaPlaceholder } from "@/components/tutorial/MediaPlaceholder";
import { TutorialLayout } from "@/components/tutorial/TutorialLayout";
import { tutorialSections } from "@/lib/tutorial-config";

export default function DashboardPage() {
  return (
    <TutorialLayout sections={tutorialSections}>
      <article className="prose prose-invert max-w-none">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white mb-0">Agent Dashboard</h1>
            <p className="text-lg text-neutral-400">
              Monitor running agents, view real-time logs, and manage active tasks from the cmux dashboard.
            </p>
          </div>

          <MediaPlaceholder
            type="image"
            description="Screenshot of the cmux dashboard showing multiple active agents"
          />

          {/* Dashboard Overview */}
          <div className="pt-4">
            <h2 className="text-2xl font-semibold text-white mb-6">Dashboard Overview</h2>

            <p className="text-neutral-400 mb-6">
              The cmux dashboard is your command center for managing AI coding agents. It provides
              real-time visibility into all running, queued, and completed tasks.
            </p>

            <div className="space-y-6">
              {/* Active Tasks Section */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Active Tasks</h3>
                    <p className="text-sm text-neutral-400">Currently running agents and their progress</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-neutral-300">
                    Each active task shows:
                  </p>

                  <ul className="text-sm text-neutral-400 space-y-2 list-disc list-inside">
                    <li><strong>Agent name</strong> and execution mode (Docker/Cloud)</li>
                    <li><strong>Repository</strong> and branch being worked on</li>
                    <li><strong>Current status</strong> - Starting, Running, Finishing, etc.</li>
                    <li><strong>Elapsed time</strong> since task started</li>
                    <li><strong>Quick actions</strong> - Open VS Code, View Logs, Stop Task</li>
                  </ul>

                  <MediaPlaceholder
                    type="image"
                    description="Screenshot showing active task cards with status indicators"
                    height="h-64"
                  />
                </div>
              </div>

              {/* Task Queue Section */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Terminal className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Task Queue</h3>
                    <p className="text-sm text-neutral-400">Pending tasks waiting to execute</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-neutral-300">
                    Tasks are queued when you reach your concurrent task limit. The queue shows:
                  </p>

                  <ul className="text-sm text-neutral-400 space-y-2 list-disc list-inside">
                    <li>Position in queue</li>
                    <li>Estimated wait time</li>
                    <li>Option to cancel or reprioritize</li>
                  </ul>

                  <Callout type="info" title="Concurrent Task Limits">
                    <p>
                      Default limits: <strong>5 local Docker tasks</strong>, <strong>unlimited cloud tasks</strong> (subject to provider limits).
                      You can adjust these in Settings.
                    </p>
                  </Callout>
                </div>
              </div>

              {/* Task History Section */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <GitBranch className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Task History</h3>
                    <p className="text-sm text-neutral-400">Completed and failed tasks</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-neutral-300">
                    Access your task history to review past work:
                  </p>

                  <ul className="text-sm text-neutral-400 space-y-2 list-disc list-inside">
                    <li>View code changes and diffs</li>
                    <li>Read agent logs and output</li>
                    <li>Rerun tasks with same configuration</li>
                    <li>Export results for documentation</li>
                  </ul>

                  <MediaPlaceholder
                    type="image"
                    description="Screenshot of task history with filters and search"
                    height="h-64"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Monitoring Individual Agents */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-6">
              Monitoring Individual Agents
            </h2>

            <p className="text-neutral-400 mb-6">
              Click on any active task to open its detailed monitoring view:
            </p>

            <MediaPlaceholder
              type="video"
              description="Video showing navigation from dashboard to detailed task view"
            />

            <div className="mt-6 grid gap-4">
              {/* Real-time Logs */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Terminal className="h-5 w-5 text-blue-400" />
                  <h4 className="font-semibold text-white text-sm">Real-time Logs</h4>
                </div>
                <p className="text-sm text-neutral-400 mb-3">
                  Watch the agent&apos;s terminal output in real-time. See every command it runs,
                  files it modifies, and errors it encounters.
                </p>
                <MediaPlaceholder
                  type="image"
                  description="Screenshot of real-time log viewer with syntax highlighting"
                  height="h-64"
                />
              </div>

              {/* VS Code Integration */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Eye className="h-5 w-5 text-purple-400" />
                  <h4 className="font-semibold text-white text-sm">VS Code Instance</h4>
                </div>
                <p className="text-sm text-neutral-400 mb-3">
                  Click &quot;Open VS Code&quot; to launch the agent&apos;s isolated development environment.
                  The git diff UI opens automatically showing all changes.
                </p>
                <MediaPlaceholder
                  type="image"
                  description="Screenshot of VS Code opened with git diff showing agent changes"
                  height="h-64"
                />
              </div>

              {/* File Changes */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <GitBranch className="h-5 w-5 text-green-400" />
                  <h4 className="font-semibold text-white text-sm">File Changes</h4>
                </div>
                <p className="text-sm text-neutral-400 mb-3">
                  See a summary of all modified, added, and deleted files. Click any file to view
                  the diff inline.
                </p>
                <MediaPlaceholder
                  type="image"
                  description="Screenshot of file changes list with diff preview"
                  height="h-64"
                />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-6">Quick Actions</h2>

            <p className="text-neutral-400 mb-6">
              cmux provides quick actions for managing running tasks:
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-4 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Eye className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm mb-1">Open VS Code</div>
                  <div className="text-xs text-neutral-400">
                    Launch the agent&apos;s VS Code instance in your browser or desktop app
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Terminal className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm mb-1">View Logs</div>
                  <div className="text-xs text-neutral-400">
                    Open full-screen log viewer with search and filtering
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <GitBranch className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm mb-1">Review Changes</div>
                  <div className="text-xs text-neutral-400">
                    Open code review interface to inspect all modifications
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg border border-red-800 bg-red-500/10">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Terminal className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <div className="font-semibold text-red-300 text-sm mb-1">Stop Task</div>
                  <div className="text-xs text-neutral-400">
                    Gracefully stop the agent and preserve its work so far
                  </div>
                </div>
              </div>
            </div>

            <Callout type="warning" title="Stopping Tasks">
              <p>
                When you stop a task, cmux attempts to gracefully shut down the agent and save
                its progress. Changes made up to that point are preserved and can be reviewed.
              </p>
            </Callout>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">Keyboard Shortcuts</h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-400">Action</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-400">Mac</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-400">Windows/Linux</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-300">New Task</td>
                    <td className="py-3 px-4 text-sm"><code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">⌘ + N</code></td>
                    <td className="py-3 px-4 text-sm"><code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">Ctrl + N</code></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-300">Open Settings</td>
                    <td className="py-3 px-4 text-sm"><code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">⌘ + ,</code></td>
                    <td className="py-3 px-4 text-sm"><code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">Ctrl + ,</code></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-300">Search Tasks</td>
                    <td className="py-3 px-4 text-sm"><code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">⌘ + K</code></td>
                    <td className="py-3 px-4 text-sm"><code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">Ctrl + K</code></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-300">Refresh Dashboard</td>
                    <td className="py-3 px-4 text-sm"><code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">⌘ + R</code></td>
                    <td className="py-3 px-4 text-sm"><code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">Ctrl + R</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Next Steps */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">Next Steps</h2>
            <div className="grid gap-3">
              <a
                href="/tutorial/logs"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Viewing Logs →</div>
                <div className="text-sm text-neutral-400">
                  Deep dive into agent logs and debugging
                </div>
              </a>
              <a
                href="/tutorial/code-review"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Code Review Interface →</div>
                <div className="text-sm text-neutral-400">
                  Learn to use cmux&apos;s built-in code review tools
                </div>
              </a>
              <a
                href="/tutorial/vscode-integration"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">VS Code Integration →</div>
                <div className="text-sm text-neutral-400">
                  Master the isolated VS Code environments
                </div>
              </a>
            </div>
          </div>
        </div>
      </article>
    </TutorialLayout>
  );
}
