'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, Terminal, GitBranch, Star, Copy, Check, ExternalLink, Github, FileText, Users, Zap, Cloud } from 'lucide-react'
import { ClientIcon } from '@/components/client-icon'
import { useState } from 'react'

export default function LandingPage() {
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
              <ClientIcon icon={Terminal} className="h-5 w-5" aria-hidden="true" />
              <span className="text-lg font-mono">cmux</span>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/manaflow-ai/cmux" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                <ClientIcon icon={Github} className="h-4 w-4" aria-hidden="true" />
                <span>GitHub</span>
                <ClientIcon icon={Star} className="h-3 w-3" aria-hidden="true" />
              </a>
              <a 
                href="https://github.com/manaflow-ai/cmux" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-neutral-800 hover:bg-neutral-900 transition-colors"
              >
                Get Started
                <ClientIcon icon={ArrowRight} className="h-3 w-3" aria-hidden="true" />
              </a>
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
            cmux spawns Claude Code, Codex, Gemini CLI, Amp, Opencode, and other coding agent CLIs in parallel across multiple tasks. 
            For each run, cmux spawns an isolated VS Code instance via Docker with the git diff UI and terminal.
          </p>

          {/* Installation Commands */}
          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <div className="flex-1 bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 font-mono text-sm flex items-center justify-between">
              <span className="text-white">$ bunx cmux</span>
              <button
                onClick={() => copyToClipboard('bunx cmux')}
                className="ml-4 text-neutral-500 hover:text-white transition-colors"
              >
                {copiedCommand === 'bunx cmux' ? <ClientIcon icon={Check} className="h-4 w-4 text-green-400" aria-hidden="true" /> : <ClientIcon icon={Copy} className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            <div className="flex-1 bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-4 py-3 font-mono text-sm flex items-center justify-between">
              <span className="text-white">$ npx cmux</span>
              <button
                onClick={() => copyToClipboard('npx cmux')}
                className="ml-4 text-neutral-500 hover:text-white transition-colors"
              >
                {copiedCommand === 'npx cmux' ? <ClientIcon icon={Check} className="h-4 w-4 text-green-400" aria-hidden="true" /> : <ClientIcon icon={Copy} className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button size="lg" className="bg-white text-black hover:bg-neutral-200" onClick={() => copyToClipboard('bunx cmux')}>
              <ClientIcon icon={Terminal} className="mr-2 h-4 w-4" aria-hidden="true" />
              Get Started with cmux
              <ClientIcon icon={ArrowRight} className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
            <a 
              href="https://github.com/manaflow-ai/cmux" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-800 hover:bg-neutral-900 transition-colors"
            >
              <ClientIcon icon={Github} className="h-4 w-4 cursor-default" aria-hidden="true" />
              <span>Star on GitHub</span>
              <ClientIcon icon={Star} className="h-3 w-3 text-yellow-500" aria-hidden="true" />
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
          <h2 className="text-2xl font-bold mb-6">The shift of the developer workflow</h2>
          <div className="space-y-4 text-neutral-400">
            <p>
              Developers now spend more time in the terminal + VS Code git extension, prompting agents and reviewing diffs.
              The workflow for coders has fundamentally changed.
            </p>
            <p>
              Typically, only four or five Claude instances can be juggled at once across different parts of the codebase. 
              Constantly switching back to VS Code UI for diffs becomes the bottleneck. Figuring out which agent is working on which part of the codebase is a pain. 
              Verifying that the agent successfully completed the task is hard.
            </p>
            <p>
              cmux spawns isolated VS Code instances for every task/coding CLI fanout. 
              Each instance opens with the git extension's diff UI and a terminal running the agent. 
              Makes <code className="px-1.5 py-0.5 bg-neutral-900 rounded text-xs">--dangerously-skip-permissions</code> actually safer.
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
          <h2 className="text-2xl font-bold mb-6">See it in action</h2>
          
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
                  <div className="text-green-400">✓ Docker containers ready</div>
                  <div className="text-green-400">✓ VS Code server initialized</div>
                  <div className="text-green-400">✓ Dashboard on localhost:3000</div>
                  <div className="text-neutral-400 mt-4">
                    Spawning isolated workspaces...
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
                          <span>Refactor auth module</span>
                        </div>
                        <div className="text-neutral-500 ml-4">Claude Code • port 8001</div>
                      </div>
                      <div className="bg-neutral-900 rounded p-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>Add test coverage</span>
                        </div>
                        <div className="text-neutral-500 ml-4">Codex • port 8002</div>
                      </div>
                      <div className="bg-neutral-900 rounded p-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Database migration</span>
                        </div>
                        <div className="text-neutral-500 ml-4">Gemini CLI • complete</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Parallel Execution */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Parallel execution</h3>
              <div className="space-y-4">
                {/* Agent Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ClientIcon icon={Terminal} className="h-4 w-4 text-blue-500" aria-hidden="true" />
                      <span className="text-sm font-mono">Claude Code</span>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-1">
                      <div>Task: auth module</div>
                      <div>VS Code: <span className="text-yellow-400">port 8001</span></div>
                      <div>Git: 3 files changed</div>
                    </div>
                  </div>
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ClientIcon icon={Terminal} className="h-4 w-4 text-purple-500" aria-hidden="true" />
                      <span className="text-sm font-mono">Codex</span>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-1">
                      <div>Task: test coverage</div>
                      <div>VS Code: <span className="text-green-400">port 8002</span></div>
                      <div>Git: tests added</div>
                    </div>
                  </div>
                  <div className="bg-neutral-900 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ClientIcon icon={Terminal} className="h-4 w-4 text-green-500" aria-hidden="true" />
                      <span className="text-sm font-mono">Gemini CLI</span>
                    </div>
                    <div className="text-xs text-neutral-500 space-y-1">
                      <div>Task: API endpoints</div>
                      <div>VS Code: <span className="text-green-400">port 8003</span></div>
                      <div>Git: ready to commit</div>
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="bg-neutral-900 rounded-lg p-3">
                  <div className="flex justify-between text-xs text-neutral-500 mb-2">
                    <span>2 of 3 tasks done</span>
                    <span>~4 min left</span>
                  </div>
                  <div className="w-full bg-neutral-800 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{width: '67%'}}></div>
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
          <h2 className="text-2xl font-bold mb-8 text-center">10x coding productivity</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={GitBranch} className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  Separate VS Code windows
                </h3>
                <p className="text-sm text-neutral-400">
                  Each agent runs in its own VS Code on a different port. 
                  localhost:8001, :8002, :8003. Click to open any of them.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={Users} className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  Multiple agent support
                </h3>
                <p className="text-sm text-neutral-400">
                  Claude Code, Codex, Gemini CLI, Amp, plus OpenCode variants. 
                  Particularly useful for Kimi K2, Qwen3 Coder, and GLM-4.5 alongside Claude Opus.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={Star} className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  Git extension UI
                </h3>
                <p className="text-sm text-neutral-400">
                  On mount, VS Code opens the git extension's diff UI. 
                  Review changes without context switching.
                </p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={FileText} className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  Rich task input
                </h3>
                <p className="text-sm text-neutral-400">
                  Paste images, reference files with @mentions, 
                  use markdown formatting. Full web dashboard.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={Cloud} className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  Configurable sandboxes
                </h3>
                <p className="text-sm text-neutral-400">
                  Docker by default, or configure with Freestyle, Morph, 
                  Daytona, Modal, Beam, or E2B.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ClientIcon icon={Zap} className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                  Task management
                </h3>
                <p className="text-sm text-neutral-400">
                  Track parallel executions, view task history, 
                  keep containers alive when needed.
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
          <h2 className="text-2xl font-bold mb-8 text-center">The Roadmap</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm">Preview environments</h3>
              <p className="text-xs text-neutral-500">
                Vercel-style previews for any repo with proper devcontainer.json
              </p>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm">Visual verification</h3>
              <p className="text-xs text-neutral-500">
                Computer-using agents for UI change screenshots
              </p>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm">Manager abstraction</h3>
              <p className="text-xs text-neutral-500">
                Automated code review and PR merging across parallel outputs
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
          <h2 className="text-2xl font-bold mb-4">Get Started in Seconds</h2>
          <p className="text-neutral-400 mb-8">
            Run cmux directly from your terminal. No installation required.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <div className="bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-6 py-3 font-mono text-sm flex items-center justify-between">
              <span>$ bunx cmux</span>
              <button
                onClick={() => copyToClipboard('bunx cmux')}
                className="ml-4 text-neutral-500 hover:text-white transition-colors"
              >
                {copiedCommand === 'bunx cmux' ? <ClientIcon icon={Check} className="h-4 w-4 text-green-400" aria-hidden="true" /> : <ClientIcon icon={Copy} className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            <div className="bg-gradient-to-r from-neutral-900 to-neutral-900/50 border border-neutral-800 rounded-lg px-6 py-3 font-mono text-sm flex items-center justify-between">
              <span>$ npx cmux</span>
              <button
                onClick={() => copyToClipboard('npx cmux')}
                className="ml-4 text-neutral-500 hover:text-white transition-colors"
              >
                {copiedCommand === 'npx cmux' ? <ClientIcon icon={Check} className="h-4 w-4 text-green-400" aria-hidden="true" /> : <ClientIcon icon={Copy} className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <p className="text-sm text-neutral-500 mb-6">
            Requires Docker. Electron and cloud versions coming soon.
          </p>

          <div className="flex items-center justify-center gap-4 text-sm">
            <a 
              href="https://github.com/manaflow-ai/cmux" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <ClientIcon icon={Github} className="h-4 w-4" />
              View on GitHub
            </a>
            <span className="text-neutral-700">•</span>
            <a 
              href="https://github.com/manaflow-ai/cmux#installation" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
            >
              Installation Guide
              <ClientIcon icon={ExternalLink} className="h-3 w-3" aria-hidden="true" />
            </a>
            <span className="text-neutral-700">•</span>
            <a 
              href="https://cal.com/team/manaflow/meeting" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
            >
              Book a Demo
              <ClientIcon icon={ExternalLink} className="h-3 w-3" aria-hidden="true" />
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
            <ClientIcon icon={Terminal} className="h-4 w-4 text-neutral-500" aria-hidden="true" />
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