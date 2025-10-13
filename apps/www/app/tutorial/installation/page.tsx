import { Download, Terminal } from "lucide-react";
import { Callout } from "@/components/tutorial/Callout";
import { CodeBlock } from "@/components/tutorial/CodeBlock";
import { MediaPlaceholder } from "@/components/tutorial/MediaPlaceholder";
import { StepCard } from "@/components/tutorial/StepCard";
import { TutorialLayout } from "@/components/tutorial/TutorialLayout";
import { tutorialSections } from "@/lib/tutorial-config";

export default function InstallationPage() {
  return (
    <TutorialLayout sections={tutorialSections}>
      <article className="prose prose-invert max-w-none">
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white mb-0">Installation</h1>
            <p className="text-lg text-neutral-400">
              Get cmux up and running on your machine in just a few minutes.
            </p>
          </div>

          {/* Prerequisites */}
          <div className="pt-4">
            <h2 className="text-2xl font-semibold text-white mb-4">Prerequisites</h2>
            <Callout type="warning" title="System Requirements">
              <p>
                Before installing cmux, ensure you have the following installed on your system:
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>macOS 12.0 or later (Apple Silicon or Intel)</li>
                <li>Docker Desktop 4.0 or later (running and configured)</li>
                <li>At least 8GB of RAM (16GB recommended)</li>
                <li>10GB of free disk space</li>
              </ul>
            </Callout>
          </div>

          {/* Installation Steps */}
          <div className="pt-4">
            <h2 className="text-2xl font-semibold text-white mb-6">Installation Steps</h2>

            <div className="space-y-0">
              <StepCard number={1} title="Download cmux">
                <p>
                  Visit the cmux releases page and download the latest version for your Mac architecture:
                </p>

                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                    <Download className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-white text-sm">Apple Silicon (M1/M2/M3)</div>
                      <div className="text-xs text-neutral-500">cmux-darwin-arm64.dmg</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-neutral-800 bg-neutral-900/50">
                    <Download className="h-5 w-5 text-blue-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-white text-sm">Intel Mac</div>
                      <div className="text-xs text-neutral-500">cmux-darwin-x64.dmg</div>
                    </div>
                  </div>
                </div>

                <MediaPlaceholder
                  type="image"
                  description="Screenshot of the GitHub releases page showing available downloads"
                  height="h-64"
                />
              </StepCard>

              <StepCard number={2} title="Install the Application">
                <p>
                  Once downloaded, open the <code className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-sm">.dmg</code> file and drag cmux to your Applications folder.
                </p>

                <MediaPlaceholder
                  type="image"
                  description="Screenshot showing the drag-and-drop installation process"
                  height="h-80"
                />

                <Callout type="info" title="First Launch Security">
                  <p>
                    On first launch, macOS may show a security warning. Go to System Settings → Privacy & Security and click &quot;Open Anyway&quot; to allow cmux to run.
                  </p>
                </Callout>
              </StepCard>

              <StepCard number={3} title="Verify Docker is Running">
                <p>
                  cmux requires Docker to create isolated environments for each agent. Make sure Docker Desktop is running before launching cmux.
                </p>

                <CodeBlock
                  code="docker ps"
                  language="bash"
                  title="Verify Docker is running"
                />

                <p className="text-sm">
                  If Docker is running correctly, you should see a list of containers (or an empty list if no containers are running).
                </p>

                <MediaPlaceholder
                  type="image"
                  description="Screenshot of Docker Desktop running in the menu bar"
                  height="h-48"
                />
              </StepCard>

              <StepCard number={4} title="Launch cmux">
                <p>
                  Open cmux from your Applications folder or Launchpad. On first launch, cmux will:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Verify your Docker installation</li>
                  <li>Download necessary container images</li>
                  <li>Set up the local development environment</li>
                  <li>Open the web interface in your default browser</li>
                </ul>

                <MediaPlaceholder
                  type="video"
                  description="Video walkthrough of the first launch experience"
                />

                <Callout type="success" title="Installation Complete!">
                  <p>
                    Once cmux opens in your browser, you&apos;re ready to configure your API keys and start running agents. Proceed to the <a href="/tutorial/first-launch" className="text-blue-400 hover:underline">First Launch</a> guide.
                  </p>
                </Callout>
              </StepCard>
            </div>
          </div>

          {/* Alternative Installation */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Alternative: Install from Source
            </h2>

            <p className="text-neutral-400 mb-4">
              For developers who want to build from source or contribute to cmux:
            </p>

            <CodeBlock
              code={`# Clone the repository
git clone https://github.com/manaflow-ai/cmux.git
cd cmux

# Install dependencies
bun install

# Build the application
bun run build:mac-arm64-prod

# The built app will be in the dist folder`}
              language="bash"
              title="Build from source"
            />

            <Callout type="tip" title="Contributing">
              <p>
                Want to contribute to cmux? Check out our <a href="https://github.com/manaflow-ai/cmux/blob/main/CONTRIBUTING.md" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">contribution guidelines</a> on GitHub.
              </p>
            </Callout>
          </div>

          {/* Next Steps */}
          <div className="pt-8 border-t border-neutral-800">
            <h2 className="text-2xl font-semibold text-white mb-4">Next Steps</h2>
            <div className="grid gap-3">
              <a
                href="/tutorial/first-launch"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">First Launch →</div>
                <div className="text-sm text-neutral-400">
                  Learn what happens on your first launch and complete initial setup
                </div>
              </a>
              <a
                href="/tutorial/api-keys"
                className="block p-4 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 transition-colors"
              >
                <div className="font-medium text-white mb-1">Configure API Keys →</div>
                <div className="text-sm text-neutral-400">
                  Set up your API keys for Claude, Codex, Gemini, and other agents
                </div>
              </a>
            </div>
          </div>
        </div>
      </article>
    </TutorialLayout>
  );
}
