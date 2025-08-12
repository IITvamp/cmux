import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '../components/ui/button'
import { ArrowRight, Terminal, GitBranch, Star, Copy, Check, ExternalLink, Github, FileText, Users, Zap, Cloud } from 'lucide-react'
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
            Orchestrate AI coding agents to do tasks in parallel
          </h1>
          
          <p className="text-lg text-neutral-400 mb-8 leading-relaxed">
            cmux orchestrates Claude, GPT-5, Gemini, and other coding agents simultaneously. 
            Each task spawns an isolated VS Code instance with git integration.
          </p>

          {/* Installation Commands */}
          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <div className="flex-1 bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 font-mono text-sm flex items-center justify-between">
              <span className="text-white">$ bunx cmux</span>
              <button
                onClick={() => copyToClipboard('bunx cmux')}
                className="ml-4 text-neutral-500 hover:text-white transition-colors"
              >
                {copiedCommand === 'bunx cmux' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex-1 bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 font-mono text-sm flex items-center justify-between">
              <span className="text-white">$ npx cmux</span>
              <button
                onClick={() => copyToClipboard('npx cmux')}
                className="ml-4 text-neutral-500 hover:text-white transition-colors"
              >
                {copiedCommand === 'npx cmux' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button asChild size="lg" className="bg-white text-black hover:bg-neutral-200">
              <Link to="/dashboard">
                Open Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <a 
              href="https://github.com/manaflow-ai/cmux" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-800 hover:bg-neutral-900 transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>Star on GitHub</span>
              <Star className="h-3 w-3 text-yellow-500" />
            </a>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="flex justify-center py-8">
        <div className="w-24 h-px bg-neutral-800"></div>
      </div>

      {/* The Problem */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Why cmux exists</h2>
          <div className="space-y-4 text-neutral-400">
            <p>
              Developers have shifted from traditional IDEs to AI-powered coding assistants. 
              Running multiple agents simultaneously requires juggling terminals and VS Code instances.
            </p>
            <p>
              Managing parallel tasks across different codebases becomes complex without proper orchestration. 
              Context switching between agents, reviewing diffs, and tracking progress slows development.
            </p>
            <p>
              cmux solves this by providing a unified dashboard for spawning and managing multiple AI agents, 
              each with isolated VS Code instances and automatic git integration.
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="flex justify-center py-8">
        <div className="w-24 h-px bg-neutral-800"></div>
      </div>

      {/* Demo Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">How it works</h2>
          
          <div className="space-y-8">
            {/* Terminal + Dashboard Demo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Terminal Install */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-xs text-neutral-500 font-mono ml-2">terminal</span>
                </div>
                <div className="p-4 font-mono text-sm space-y-2">
                  <div className="text-neutral-500">$ bunx cmux</div>
                  <div className="text-green-400">✓ Installing cmux...</div>
                  <div className="text-green-400">✓ Setting up environment...</div>
                  <div className="text-green-400">✓ Starting web server on http://localhost:3000</div>
                  <div className="text-neutral-400 mt-4">
                    Opening dashboard in browser...
                  </div>
                </div>
              </div>

              {/* Dashboard Preview */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-xs text-neutral-500 font-mono ml-2">localhost:3000</span>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Active Tasks</span>
                      <span className="text-xs text-neutral-500">3 running</span>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-neutral-900 rounded p-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>Implement auth flow</span>
                        </div>
                        <div className="text-neutral-500 ml-4">Claude Opus 4.1 • 2m ago</div>
                      </div>
                      <div className="bg-neutral-900 rounded p-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>Add test coverage</span>
                        </div>
                        <div className="text-neutral-500 ml-4">GPT-5 • 3m ago</div>
                      </div>
                      <div className="bg-neutral-900 rounded p-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Security audit</span>
                        </div>
                        <div className="text-neutral-500 ml-4">Gemini Pro • 5m ago</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Parallel Execution */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Parallel Agent Execution</h3>
              <div className="space-y-4">
                {/* Agent Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-mono">Claude Opus 4.1</span>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-1">
                      <div>Task: Authentication flow</div>
                      <div>Status: <span className="text-yellow-400">In progress</span></div>
                      <div>Port: 8001</div>
                    </div>
                  </div>
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-mono">GPT-5</span>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-1">
                      <div>Task: Test coverage</div>
                      <div>Status: <span className="text-green-400">Complete</span></div>
                      <div>Port: 8002</div>
                    </div>
                  </div>
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Terminal className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-mono">Gemini Pro</span>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-1">
                      <div>Task: Security audit</div>
                      <div>Status: <span className="text-yellow-400">In progress</span></div>
                      <div>Port: 8003</div>
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="bg-neutral-900 rounded-lg p-3">
                  <div className="flex justify-between text-xs text-neutral-500 mb-2">
                    <span>Overall Progress</span>
                    <span>67% Complete</span>
                  </div>
                  <div className="w-full bg-neutral-800 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" style={{width: '67%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="flex justify-center py-8">
        <div className="w-24 h-px bg-neutral-800"></div>
      </div>

      {/* Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Core Features</h2>
          
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

      {/* Divider */}
      <div className="flex justify-center py-8">
        <div className="w-24 h-px bg-neutral-800"></div>
      </div>

      {/* Roadmap */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Coming Soon</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm">Preview Environments</h3>
              <p className="text-xs text-neutral-500">
                Automatic preview deployments for every task with devcontainer.json support
              </p>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm">Visual Testing</h3>
              <p className="text-xs text-neutral-500">
                Computer-using agents capture before/after screenshots of UI changes
              </p>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm">Manager Agent</h3>
              <p className="text-xs text-neutral-500">
                Automated code review and PR merging across parallel agent outputs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="flex justify-center py-8">
        <div className="w-24 h-px bg-neutral-800"></div>
      </div>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Start using cmux</h2>
          <p className="text-neutral-400 mb-8">
            Install via CLI or use the web dashboard directly
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <div className="bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-6 py-3 font-mono text-sm flex items-center justify-between">
              <span>$ bunx cmux</span>
              <button
                onClick={() => copyToClipboard('bunx cmux')}
                className="ml-4 text-neutral-500 hover:text-white transition-colors"
              >
                {copiedCommand === 'bunx cmux' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-6 py-3 font-mono text-sm flex items-center justify-between">
              <span>$ npx cmux</span>
              <button
                onClick={() => copyToClipboard('npx cmux')}
                className="ml-4 text-neutral-500 hover:text-white transition-colors"
              >
                {copiedCommand === 'npx cmux' ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
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
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="flex justify-center py-8">
        <div className="w-24 h-px bg-neutral-800"></div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-neutral-500" />
            <span className="text-sm text-neutral-500 font-mono">cmux by manaflow</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-neutral-500">
            <a href="https://github.com/manaflow-ai/cmux" className="hover:text-white transition-colors">GitHub</a>
            <a href="https://twitter.com/manaflowai" className="hover:text-white transition-colors">Twitter</a>
            <a href="https://discord.gg/7VY58tftMg" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  )
}