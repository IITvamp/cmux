import { ArrowRight, BookOpen, Rocket, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { TutorialLayout } from "@/components/tutorial/TutorialLayout";
import { tutorialSections } from "@/lib/tutorial-config";

export default function TutorialIndexPage() {
  return (
    <TutorialLayout sections={tutorialSections}>
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white">
            Welcome to cmux Documentation
          </h1>
          <p className="text-lg text-neutral-400 leading-relaxed">
            Learn how to manage multiple AI coding agents in parallel, verify their work efficiently,
            and scale your development workflow to handle 10, 20, or 100 simultaneous tasks.
          </p>
        </div>

        {/* Quick Start Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <Link
            href="/tutorial/installation"
            className="group p-6 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 hover:bg-neutral-900 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-blue-400" />
                  <h3 className="font-semibold text-white">Quick Start</h3>
                </div>
                <p className="text-sm text-neutral-400">
                  Get cmux installed and running in under 5 minutes
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-neutral-600 group-hover:text-blue-400 transition-colors" />
            </div>
          </Link>

          <Link
            href="/tutorial/understanding-cmux"
            className="group p-6 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 hover:bg-neutral-900 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-purple-400" />
                  <h3 className="font-semibold text-white">Core Concepts</h3>
                </div>
                <p className="text-sm text-neutral-400">
                  Understand how cmux works and why isolation matters
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-neutral-600 group-hover:text-purple-400 transition-colors" />
            </div>
          </Link>

          <Link
            href="/tutorial/api-keys"
            className="group p-6 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 hover:bg-neutral-900 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-green-400" />
                  <h3 className="font-semibold text-white">Configuration</h3>
                </div>
                <p className="text-sm text-neutral-400">
                  Set up API keys and configure your environment
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-neutral-600 group-hover:text-green-400 transition-colors" />
            </div>
          </Link>

          <Link
            href="/tutorial/creating-tasks"
            className="group p-6 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-blue-500/50 hover:bg-neutral-900 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  <h3 className="font-semibold text-white">Run Your First Task</h3>
                </div>
                <p className="text-sm text-neutral-400">
                  Create and execute your first AI coding task
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-neutral-600 group-hover:text-yellow-400 transition-colors" />
            </div>
          </Link>
        </div>

        {/* Documentation Sections */}
        <div className="pt-8 space-y-6">
          <h2 className="text-2xl font-semibold text-white">
            Complete Documentation
          </h2>

          <div className="space-y-8">
            {tutorialSections.map((section) => (
              <div key={section.slug} className="space-y-3">
                <h3 className="text-lg font-semibold text-white">
                  {section.title}
                </h3>
                {section.subsections && section.subsections.length > 0 ? (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {section.subsections.map((subsection) => (
                      <li key={subsection.slug}>
                        <Link
                          href={`/tutorial/${subsection.slug}`}
                          className="block px-4 py-2 rounded-md text-sm text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
                        >
                          {subsection.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Link
                    href={`/tutorial/${section.slug}`}
                    className="block px-4 py-2 rounded-md text-sm text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors w-fit"
                  >
                    View {section.title}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Help Section */}
        <div className="pt-8 border-t border-neutral-800">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              Need Help?
            </h3>
            <p className="text-sm text-neutral-400 mb-4">
              Join our community or reach out to the team for support.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://discord.gg/7VY58tftMg"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 transition-colors"
              >
                Join Discord
              </a>
              <a
                href="https://github.com/manaflow-ai/cmux"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-neutral-700 text-neutral-300 text-sm font-medium hover:bg-neutral-800 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </TutorialLayout>
  );
}
