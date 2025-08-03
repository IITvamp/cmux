This project is called cmux. cmux is a web app that spawns Claude Code, Codex CLI, Gemini CLI, Amp, Opencode, and other coding agent CLIs in parallel across multiple tasks. For each run, cmux spawns an isolated openvscode instance via Docker or a configurable sandbox provider (like Morph/Daytona/E2B). The openvscode instance by default opens the git diff UI and a terminal with the running dev server (configurable via devcontainer.json).

# Config

Use pnpm to install dependencies and run the project.
`./scripts/dev.sh` will start the project.
After finishing a task, run `bun run typecheck` in root to typecheck everything.

# Backend

This project uses Convex.
Schemas are defined in packages/convex/convex/schema.ts.

# Misc

Always use node: prefixes for node imports.
Do not use the any type.
