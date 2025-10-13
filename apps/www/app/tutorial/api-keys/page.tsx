import { Key, Lock, Settings } from "lucide-react";
import { Callout } from "@/components/tutorial/Callout";
import { CodeBlock } from "@/components/tutorial/CodeBlock";
import { MediaPlaceholder } from "@/components/tutorial/MediaPlaceholder";
import { StepCard } from "@/components/tutorial/StepCard";
import { TutorialLayout } from "@/components/tutorial/TutorialLayout";
import { tutorialSections } from "@/lib/tutorial-config";

export default function ApiKeysPage() {
  return (
    <TutorialLayout sections={tutorialSections}>
      <article className="prose prose-invert max-w-none">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white mb-0">Configuring API Keys</h1>
            <p className="text-lg text-neutral-400">
              Set up authentication for AI coding agents. Each agent requires API keys from their respective providers.
            </p>
          </div>

          <Callout type="warning" title="Security Note">
            <p>
              API keys are stored locally and encrypted. cmux never sends your API keys to any server.
              They are only used within your local Docker containers or cloud sandboxes.
            </p>
          </Callout>

          {/* Accessing Settings */}
          <div className="pt-4">
            <h2 className="text-2xl font-semibold text-white mb-6">Accessing API Key Settings</h2>

            <div className="space-y-0">
              <StepCard number={1} title="Open Settings">
                <p>
                  Click the settings icon in the top-right corner of the cmux dashboard, or press{" "}
                  <code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-sm">⌘ + ,</code>{" "}
                  (Mac) to open settings.
                </p>

                <MediaPlaceholder
                  type="image"
                  description="Screenshot showing the settings button location in cmux dashboard"
                  height="h-64"
                />
              </StepCard>

              <StepCard number={2} title="Navigate to API Keys">
                <p>
                  In the settings panel, select the &quot;API Keys&quot; tab. You&apos;ll see a list of all supported
                  agent providers.
                </p>

                <MediaPlaceholder
                  type="image"
                  description="Screenshot of the API Keys settings panel showing all providers"
                />
              </StepCard>

              <StepCard number={3} title="Add Your Keys">
                <p>
                  Click on a provider to expand its configuration options. Paste your API key and click
                  &quot;Save&quot;. cmux will automatically validate the key.
                </p>

                <MediaPlaceholder
                  type="image"
                  description="Screenshot showing the API key input field and validation status"
                  height="h-64"
                />
              </StepCard>
            </div>
          </div>

          {/* Provider-Specific Guides */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-6">
              Provider Setup Guides
            </h2>

            <div className="space-y-4">
              {/* Anthropic */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Key className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Anthropic (Claude)</h3>
                    <p className="text-sm text-neutral-400">Required for Claude Code agent</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-neutral-300">
                    Get your API key from the Anthropic Console:
                  </p>

                  <ol className="text-sm text-neutral-400 space-y-2 list-decimal list-inside">
                    <li>
                      Visit{" "}
                      <a
                        href="https://console.anthropic.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        console.anthropic.com
                      </a>
                    </li>
                    <li>Sign in or create an account</li>
                    <li>Navigate to &quot;API Keys&quot; in the left sidebar</li>
                    <li>Click &quot;Create Key&quot; and copy it immediately</li>
                    <li>Paste the key into cmux settings</li>
                  </ol>

                  <CodeBlock
                    code="ANTHROPIC_API_KEY=sk-ant-api03-..."
                    language="bash"
                    title="Example format"
                  />

                  <a
                    href="/tutorial/anthropic-setup"
                    className="inline-block text-sm text-blue-400 hover:underline"
                  >
                    Detailed Anthropic setup guide →
                  </a>
                </div>
              </div>

              {/* OpenAI */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Key className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">OpenAI (Codex)</h3>
                    <p className="text-sm text-neutral-400">Required for Codex CLI agent</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-neutral-300">
                    Get your API key from the OpenAI Platform:
                  </p>

                  <ol className="text-sm text-neutral-400 space-y-2 list-decimal list-inside">
                    <li>
                      Visit{" "}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        platform.openai.com/api-keys
                      </a>
                    </li>
                    <li>Sign in to your OpenAI account</li>
                    <li>Click &quot;Create new secret key&quot;</li>
                    <li>Name your key (e.g., &quot;cmux&quot;) and copy it</li>
                    <li>Paste the key into cmux settings</li>
                  </ol>

                  <CodeBlock
                    code="OPENAI_API_KEY=sk-proj-..."
                    language="bash"
                    title="Example format"
                  />

                  <a
                    href="/tutorial/openai-setup"
                    className="inline-block text-sm text-blue-400 hover:underline"
                  >
                    Detailed OpenAI setup guide →
                  </a>
                </div>
              </div>

              {/* Google */}
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Key className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">Google (Gemini)</h3>
                    <p className="text-sm text-neutral-400">Required for Gemini CLI agent</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-neutral-300">
                    Get your API key from Google AI Studio:
                  </p>

                  <ol className="text-sm text-neutral-400 space-y-2 list-decimal list-inside">
                    <li>
                      Visit{" "}
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        makersuite.google.com/app/apikey
                      </a>
                    </li>
                    <li>Sign in with your Google account</li>
                    <li>Click &quot;Create API Key&quot;</li>
                    <li>Select or create a Google Cloud project</li>
                    <li>Copy the generated key and paste into cmux</li>
                  </ol>

                  <CodeBlock
                    code="GOOGLE_API_KEY=AIzaSy..."
                    language="bash"
                    title="Example format"
                  />

                  <a
                    href="/tutorial/google-setup"
                    className="inline-block text-sm text-blue-400 hover:underline"
                  >
                    Detailed Google setup guide →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Validation */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">Key Validation</h2>

            <p className="text-neutral-400 mb-6">
              When you save an API key, cmux automatically validates it by making a test request.
              You&apos;ll see one of these status indicators:
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <div>
                  <div className="text-sm font-medium text-green-300">Valid</div>
                  <div className="text-xs text-neutral-400">Key is authenticated and working</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10">
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                <div>
                  <div className="text-sm font-medium text-red-300">Invalid</div>
                  <div className="text-xs text-neutral-400">Key authentication failed - check your key</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <div>
                  <div className="text-sm font-medium text-yellow-300">Unverified</div>
                  <div className="text-xs text-neutral-400">Key saved but not yet validated</div>
                </div>
              </div>
            </div>

            <MediaPlaceholder
              type="image"
              description="Screenshot showing API key validation status indicators"
              height="h-64"
            />
          </div>

          {/* Security Best Practices */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Security Best Practices
            </h2>

            <div className="space-y-4">
              <Callout type="tip" title="Use Separate Keys">
                <p>
                  Create dedicated API keys for cmux instead of reusing keys from other applications.
                  This makes it easier to rotate or revoke keys if needed.
                </p>
              </Callout>

              <Callout type="warning" title="Set Usage Limits">
                <p>
                  Most providers allow you to set monthly spending limits on API keys. This prevents
                  unexpected charges if something goes wrong.
                </p>
              </Callout>

              <Callout type="danger" title="Never Share Keys">
                <p>
                  API keys are like passwords. Never share them, commit them to git, or include them
                  in screenshots or videos.
                </p>
              </Callout>
            </div>
          </div>

          {/* Next Steps */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">Next Steps</h2>
            <div className="grid gap-3">
              <a
                href="/tutorial/creating-tasks"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Create Your First Task →</div>
                <div className="text-sm text-neutral-400">
                  Now that your API keys are configured, start running agents
                </div>
              </a>
              <a
                href="/tutorial/available-agents"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Learn About Agents →</div>
                <div className="text-sm text-neutral-400">
                  Understand which agents work best for different tasks
                </div>
              </a>
            </div>
          </div>
        </div>
      </article>
    </TutorialLayout>
  );
}
