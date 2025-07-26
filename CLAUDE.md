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

# Publishing cmux CLI to npm

cmux is published as a single-file executable binary to npm. The binary includes:

- Convex backend (binary + SQLite database)
- Web UI static files (public/dist)
- All dependencies bundled

## Build and publish process:

1. **Update version** in packages/cmux/package.json

2. **Build the cmux-cli bundle**:

   ```bash
   ./scripts/build-cli.ts
   ```

   This script:
   - Builds the client with VITE_CONVEX_URL=http://localhost:9777
   - Copies client dist to packages/cmux/public
   - Builds convex CLI bundle
   - Starts local convex backend
   - Deploys convex functions
   - Creates cmux-bundle.zip with everything (convex + public files)
   - Copies the cmux package.json to the bundle (for version checking)
   - Compiles cmux-cli binary using Bun

3. **Publish to npm**:
   ```bash
   (cd packages/cmux && npm run publish-cli)
   ```
   This runs scripts/publish-npm.ts which:
   - Creates clean npm package with just binary + README
   - Runs npm pkg fix
   - Publishes to npm registry

The published package allows users to:

```bash
npm install -g cmux
cmux  # Runs on port 9776, extracts bundle to ~/.cmux on first run
```

## Important Build Notes:

### Version Checking

**Critical**: Always increment the version number BEFORE running the build script. The build process embeds the package.json into the bundle, which is used for version checking during upgrades. The correct workflow is:

1. Update version in both files
2. Run build script
3. Publish to npm

This ensures the bundle contains the correct version for upgrade detection.
