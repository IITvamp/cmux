<h1 align="center">cmux</h1>
<p align="center">open source Claude Code manager that supports Codex/Gemini/OpenCode/Amp CLI</p>

<p align="center"><code>bunx cmux</code> or <code>npx cmux</code></p>

cmux is an app that spawns Claude Code, Codex CLI, Cursor CLI, Gemini CLI, Amp, Opencode, and other coding agent CLIs in parallel across multiple tasks. For each run, cmux spawns an isolated openvscode instance via Docker or a configurable sandbox provider (like Morph/Daytona/E2B). The openvscode instance by default opens the git diff UI and a terminal with the running dev server (configurable via devcontainer.json).

## Install

cmux supports macOS (Apple Silicon, x64 coming soon). Linux and Windows support is also coming soon.

```bash
# with bun
bunx cmux@latest

# with npm
npx cmux@latest

# with uv
uvx cmux@latest
```

<!-- ## Upgrade

```bash
cmux upgrade
``` -->

## Uninstall

```bash
cmux uninstall
```
