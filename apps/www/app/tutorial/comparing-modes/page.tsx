import { Cloud, Container, Server } from "lucide-react";
import { Callout } from "@/components/tutorial/Callout";
import { MediaPlaceholder } from "@/components/tutorial/MediaPlaceholder";
import { TutorialLayout } from "@/components/tutorial/TutorialLayout";
import { tutorialSections } from "@/lib/tutorial-config";

export default function ComparingModesPage() {
  return (
    <TutorialLayout sections={tutorialSections}>
      <article className="prose prose-invert max-w-none">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white mb-0">Execution Modes</h1>
            <p className="text-lg text-neutral-400">
              cmux supports three execution modes: Local Docker, Cloud Sandbox, and Cloud Environment.
              Each mode offers different tradeoffs between performance, cost, and convenience.
            </p>
          </div>

          <MediaPlaceholder
            type="image"
            description="Screenshot of the execution mode selector in cmux dashboard"
          />

          {/* Mode Overview */}
          <div className="pt-4">
            <h2 className="text-2xl font-semibold text-white mb-6">Available Modes</h2>

            <div className="space-y-6">
              {/* Local Docker */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Container className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-xl font-semibold text-white">Local Docker Mode</h3>
                    <p className="text-neutral-400">
                      Runs agents in Docker containers on your local machine. Each agent gets its own
                      isolated container with VS Code, git, and your development environment.
                    </p>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <div className="text-sm font-semibold text-green-400 mb-2">Advantages</div>
                        <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
                          <li>No cloud costs</li>
                          <li>Full local control</li>
                          <li>Works offline</li>
                          <li>Fast file access</li>
                          <li>Privacy guaranteed</li>
                        </ul>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-yellow-400 mb-2">Disadvantages</div>
                        <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
                          <li>Uses local resources</li>
                          <li>Limited by RAM/CPU</li>
                          <li>Slower cold starts</li>
                          <li>Manual Docker setup</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                        Recommended for most users
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                        No additional costs
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cloud Sandbox */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Cloud className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-xl font-semibold text-white">Cloud Sandbox Mode</h3>
                    <p className="text-neutral-400">
                      Spins up ephemeral cloud sandboxes using providers like Modal, E2B, or similar services.
                      Fast provisioning with pre-warmed environments and unlimited scale.
                    </p>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <div className="text-sm font-semibold text-green-400 mb-2">Advantages</div>
                        <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
                          <li>Instant provisioning</li>
                          <li>Pre-warmed containers</li>
                          <li>Scales infinitely</li>
                          <li>No local resources</li>
                          <li>Automatic cleanup</li>
                        </ul>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-yellow-400 mb-2">Disadvantages</div>
                        <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
                          <li>Costs per execution</li>
                          <li>Network latency</li>
                          <li>Requires internet</li>
                          <li>Third-party dependency</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
                        Best for high-volume workflows
                      </span>
                      <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium">
                        Pay-per-use pricing
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cloud Environment */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Server className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <h3 className="text-xl font-semibold text-white">Cloud Environment Mode</h3>
                    <p className="text-neutral-400">
                      Provisions persistent cloud development environments (similar to GitHub Codespaces or Gitpod).
                      Environments stay alive between sessions and can be accessed from anywhere.
                    </p>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <div className="text-sm font-semibold text-green-400 mb-2">Advantages</div>
                        <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
                          <li>Persistent state</li>
                          <li>Access from anywhere</li>
                          <li>Consistent environments</li>
                          <li>Pre-configured setups</li>
                          <li>Team sharing</li>
                        </ul>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-yellow-400 mb-2">Disadvantages</div>
                        <ul className="text-sm text-neutral-400 space-y-1 list-disc list-inside">
                          <li>Higher costs</li>
                          <li>Slower provisioning</li>
                          <li>Manual management</li>
                          <li>Billing while idle</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                        Best for long-running tasks
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                        Team collaboration
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-6">Side-by-Side Comparison</h2>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-400">Feature</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-blue-400">Local Docker</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-purple-400">Cloud Sandbox</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-emerald-400">Cloud Environment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-400">Startup Time</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">30-60s</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">5-10s</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">60-120s</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-400">Cost</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Free</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">$0.01-0.10/run</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">$0.10-1.00/hour</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-400">Max Parallel Tasks</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Limited by RAM</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Unlimited</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Configurable</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-400">Persistence</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Session only</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Session only</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Persistent</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-400">Internet Required</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">No</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Yes</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Yes</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-neutral-400">Setup Complexity</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Medium</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Low</td>
                    <td className="py-3 px-4 text-sm text-neutral-300">Medium</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Selecting a Mode */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">How to Select a Mode</h2>

            <p className="text-neutral-400 mb-6">
              You can select your execution mode when creating a new task or set a default in your settings:
            </p>

            <MediaPlaceholder
              type="image"
              description="Screenshot showing the execution mode selector in task creation"
            />

            <div className="mt-6 space-y-4">
              <Callout type="tip" title="Recommendation">
                <p>
                  Start with <strong>Local Docker Mode</strong> if you&apos;re new to cmux. It&apos;s free,
                  private, and works great for most use cases. Switch to cloud modes later if you need more
                  scale or want to offload compute from your machine.
                </p>
              </Callout>

              <Callout type="info" title="Switching Modes">
                <p>
                  You can mix and match modes for different tasks. For example, use Local Docker for
                  sensitive code and Cloud Sandbox for high-volume batch operations.
                </p>
              </Callout>
            </div>
          </div>

          {/* Next Steps */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">Learn More</h2>
            <div className="grid gap-3">
              <a
                href="/tutorial/local-docker"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Local Docker Mode →</div>
                <div className="text-sm text-neutral-400">
                  Detailed guide to setting up and using Local Docker mode
                </div>
              </a>
              <a
                href="/tutorial/cloud-sandbox"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Cloud Sandbox Mode →</div>
                <div className="text-sm text-neutral-400">
                  Configure and use cloud sandbox providers
                </div>
              </a>
              <a
                href="/tutorial/cloud-environment"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Cloud Environment Mode →</div>
                <div className="text-sm text-neutral-400">
                  Set up persistent cloud development environments
                </div>
              </a>
            </div>
          </div>
        </div>
      </article>
    </TutorialLayout>
  );
}
