import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '../components/ui/button'
import { ArrowRight, Terminal, GitBranch, Star, Copy, Check, ExternalLink, Github, FileText, Users, Zap, Globe, Shield, Cloud } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/landing')({
  component: LandingPage,
})

function LandingPage() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCommand(text)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto">
      {/* Navigation */}
      <nav className="sticky top-0 w-full z-50 bg-black/90 backdrop-blur-sm border-b border-neutral-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              <span className="text-lg font-mono">cmux</span>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/manaflow-ai/cmux" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
                <Star className="h-3 w-3" />
              </a>
              <Button asChild size="sm" variant="outline" className="border-neutral-800 text-white hover:bg-neutral-900">
                <Link to="/dashboard">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 font-mono">
            Orchestrate 20+ coding agents in parallel with a powerful web UI
          </h1>
          
          <p className="text-lg text-neutral-400 mb-8 leading-relaxed">
            cmux is a sophisticated web application that lets you run Claude, GPT-5, Gemini, and 20+ other coding agents simultaneously. 
            Rich text editor with image support, GitHub integration, and isolated VS Code instances for every task.
          </p>

          {/* Key Features Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-center">
              <div className="text-2xl font-bold text-white">20+</div>
              <div className="text-sm text-neutral-400">AI Agents</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-center">
              <div className="text-2xl font-bold text-white">Web UI</div>
              <div className="text-sm text-neutral-400">Rich Editor</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-center">
              <div className="text-2xl font-bold text-white">GitHub</div>
              <div className="text-sm text-neutral-400">Integration</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-center">
              <div className="text-2xl font-bold text-white">VS Code</div>
              <div className="text-sm text-neutral-400">Instances</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button asChild className="bg-white text-black hover:bg-neutral-200">
              <Link to="/dashboard">
                Try cmux
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <a 
              href="https://github.com/manaflow-ai/cmux" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-800 hover:bg-neutral-900 transition-colors"
            >
              <Star className="h-4 w-4" />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-neutral-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">The Problem</h2>
          <div className="space-y-4 text-neutral-400">
            <p>
              If you're like me, you've almost completely moved from Cursor to Claude Code. 
              You spend more time in the terminal + VS Code git extension than in Cursor's sidebar.
            </p>
            <p>
              But you can only juggle four or five Claudes at a time in different parts of the codebase. 
              And you still keep going back to the VS Code UI for diffs.
            </p>
            <p>
              That's why I built cmux — to spawn isolated VS Code instances (making <code className="px-1.5 py-0.5 bg-neutral-900 rounded text-sm">--dangerously-skip-permissions</code> safer!) 
              for every task/coding CLI fanout.
            </p>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-neutral-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">How it works</h2>
          
          <div className="space-y-8">
            {/* Dashboard UI Demo */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-xs text-neutral-500 font-mono ml-2">cmux dashboard</span>
              </div>
              <div className="p-4">
                {/* Mock Dashboard UI */}
                <div className="space-y-4">
                  {/* Task Input Area */}
                  <div className="bg-neutral-900 rounded-lg p-3 border border-neutral-800">
                    <div className="text-sm text-neutral-400 mb-2">Task Description</div>
                    <div className="bg-neutral-950 rounded p-2 min-h-[60px] text-sm">
                      <span className="text-white">Fix authentication flow and add comprehensive test coverage. Also check for any security vulnerabilities in the current implementation.</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button className="text-xs px-2 py-1 bg-neutral-800 rounded text-neutral-400">📎 Add image</button>
                      <button className="text-xs px-2 py-1 bg-neutral-800 rounded text-neutral-400">🎤 Voice input</button>
                    </div>
                  </div>
                  
                  {/* Agent Selection */}
                  <div className="bg-neutral-900 rounded-lg p-3 border border-neutral-800">
                    <div className="text-sm text-neutral-400 mb-2">Select Agents (20+ available)</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked readOnly className="rounded" />
                        <span>Claude Opus 4.1</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked readOnly className="rounded" />
                        <span>GPT-5</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked readOnly className="rounded" />
                        <span>Gemini Pro</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded" readOnly />
                        <span>Kimi K2</span>
                      </label>
                    </div>
                    <div className="text-xs text-neutral-500 mt-2">+ 16 more agents available...</div>
                  </div>
                  
                  {/* GitHub Integration */}
                  <div className="flex gap-2">
                    <div className="flex-1 bg-neutral-900 rounded-lg px-3 py-2 border border-neutral-800">
                      <div className="text-xs text-neutral-500">Repository</div>
                      <div className="text-sm">manaflow-ai/cmux</div>
                    </div>
                    <div className="flex-1 bg-neutral-900 rounded-lg px-3 py-2 border border-neutral-800">
                      <div className="text-xs text-neutral-500">Branch</div>
                      <div className="text-sm">feature/auth-fixes</div>
                    </div>
                  </div>
                  
                  <button className="w-full bg-white text-black py-2 rounded-lg font-medium text-sm hover:bg-neutral-200 transition-colors">
                    Run Agents in Parallel
                  </button>
                </div>
              </div>
            </div>

            {/* Task List View */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800">
                <span className="text-sm font-medium">Active Tasks</span>
              </div>
              <div className="divide-y divide-neutral-800">
                <div className="p-3 hover:bg-neutral-900/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm">Fix authentication flow and add tests</span>
                      </div>
                      <div className="flex gap-4 text-xs text-neutral-500">
                        <span>Claude Opus 4.1</span>
                        <span>•</span>
                        <span>manaflow-ai/cmux</span>
                        <span>•</span>
                        <span>2 minutes ago</span>
                      </div>
                    </div>
                    <button className="text-xs px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700">Open VS Code</button>
                  </div>
                </div>
                <div className="p-3 hover:bg-neutral-900/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm">Optimize database queries</span>
                      </div>
                      <div className="flex gap-4 text-xs text-neutral-500">
                        <span>GPT-5</span>
                        <span>•</span>
                        <span>backend-api</span>
                        <span>•</span>
                        <span>5 minutes ago</span>
                      </div>
                    </div>
                    <button className="text-xs px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700">View Diff</button>
                  </div>
                </div>
                <div className="p-3 hover:bg-neutral-900/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm">Implement dark mode toggle</span>
                      </div>
                      <div className="flex gap-4 text-xs text-neutral-500">
                        <span>Gemini Pro</span>
                        <span>•</span>
                        <span>frontend-app</span>
                        <span>•</span>
                        <span>8 minutes ago</span>
                      </div>
                    </div>
                    <button className="text-xs px-2 py-1 bg-neutral-800 rounded hover:bg-neutral-700">Keep Alive</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-neutral-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Why cmux?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-neutral-500" />
                  Isolated workspaces
                </h3>
                <p className="text-sm text-neutral-400">
                  Each agent gets its own VS Code instance with isolated git worktrees. 
                  No more conflicts or accidental overwrites.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-neutral-500" />
                  20+ AI agents
                </h3>
                <p className="text-sm text-neutral-400">
                  Claude (Sonnet, Opus 4.1, Opus 4), GPT-5, O3, Gemini (Flash, Pro), 
                  Kimi K2, Qwen3 Coder, GLM-4.5, and many more - all in one interface.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4 text-neutral-500" />
                  Git-first workflow
                </h3>
                <p className="text-sm text-neutral-400">
                  Automatically opens git diff UI and terminal with your agent. 
                  Review changes instantly without context switching.
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-neutral-500" />
                  Rich task editor
                </h3>
                <p className="text-sm text-neutral-400">
                  Markdown support, image uploads, @mentions for files, voice input, 
                  and persistent drafts. Not just a CLI - a full web experience.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-neutral-500" />
                  Cloud & local modes
                </h3>
                <p className="text-sm text-neutral-400">
                  Run agents in the cloud or locally. Configurable sandboxes with 
                  Docker, Freestyle, Morph, Daytona, Modal, Beam, or E2B.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-neutral-500" />
                  Task management
                </h3>
                <p className="text-sm text-neutral-400">
                  Track all running tasks, view history, keep containers alive, 
                  and manage multiple projects from one dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Caveats */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-neutral-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Current limitations</h2>
          <div className="space-y-4 text-neutral-400">
            <p>
              The bottleneck of running many agents in parallel is still reviewing and verifying the work. 
              We're working on:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>"Vercel preview environments" for any repo with a proper devcontainer.json</li>
              <li>Computer-using agents to click around and take before/after screenshots for UI changes</li>
              <li>A real "manager" abstraction above manually reviewing code and merging PRs</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-neutral-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to parallelize your coding?</h2>
          <p className="text-neutral-400 mb-8">
            Install in seconds. No credit card required.
          </p>
          
          <div className="flex flex-col items-center gap-4 mb-8">
            <Button asChild size="lg" className="bg-white text-black hover:bg-neutral-200">
              <Link to="/dashboard">
                Open cmux Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-neutral-500">
              Web-based interface • No installation required • Start for free
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm">
            <a 
              href="https://github.com/manaflow-ai/cmux" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
            <span className="text-neutral-700">•</span>
            <a 
              href="https://cal.com/team/manaflow/meeting" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
            >
              Book a call
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-neutral-700">•</span>
            <Link to="/dashboard" className="text-neutral-400 hover:text-white transition-colors">
              Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-neutral-900">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-neutral-500" />
            <span className="text-sm text-neutral-500 font-mono">cmux by manaflow</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-neutral-500">
            <a href="https://github.com/manaflow-ai/cmux" className="hover:text-white transition-colors">GitHub</a>
            <a href="https://twitter.com" className="hover:text-white transition-colors">Twitter</a>
            <a href="https://discord.com" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  )
}