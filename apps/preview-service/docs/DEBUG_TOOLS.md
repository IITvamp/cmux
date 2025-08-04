# Debug Tools Documentation

## Overview

The preview service includes several debug utilities for testing and exploring preview environments.

## Quick Debug Script

The quickest way to create a debug instance:

```bash
bun run ./scripts/quick-debug.ts [git-url] [branch] [snapshot-id]
```

### Examples

```bash
# Use all defaults (vscode-remote-try-node repo)
bun run ./scripts/quick-debug.ts

# Custom repository
bun run ./scripts/quick-debug.ts https://github.com/user/repo main

# Custom repository with specific snapshot
bun run ./scripts/quick-debug.ts https://github.com/user/repo main snapshot_custom123
```

### Defaults

- **Repository**: `https://github.com/microsoft/vscode-remote-try-node`
- **Branch**: `main`
- **Snapshot**: `$MORPH_BASE_SNAPSHOT_ID` or `snapshot_7o3z2iez` (full snapshot with VSCode + Docker)

### Features

- Creates preview environment immediately
- Shows VSCode and Worker URLs
- Keeps running until Ctrl+C
- Instance continues after script exits

## Interactive Debug Tool

For more control:

```bash
pnpm debug:instance
```

### Features

1. **Repository Selection**: Prompts for Git URL and branch
2. **Interactive Menu**:
   - Open VSCode in browser
   - Execute commands on instance
   - Check instance status
   - Pause instance (creates snapshot)
   - Stop instance
   - Exit (keep running)

### Example Session

```
🔧 Debug Instance Utility

Using base snapshot: snapshot_7o3z2iez

Git repository URL (default: https://github.com/microsoft/vscode-remote-try-node): 
Branch (default: main): 

📦 Creating preview environment...

✅ Preview created: morphvm_xxxxx

🌐 Service URLs:
VSCode: https://vscode-morphvm-xxxxx.http.cloud.morph.so
Worker: https://worker-morphvm-xxxxx.http.cloud.morph.so

🎯 What would you like to do?
1. Open VSCode in browser
2. Execute a command
3. Check instance status
4. Pause instance
5. Stop instance
6. Exit (keep instance running)

Enter choice (1-6): 
```

## Cleanup Script

To stop instances manually:

```bash
bun run ./scripts/cleanup-instance.ts <instance-id>
```

## Base Snapshots

The debug tools use a base snapshot that includes:

- **Docker-in-Docker**: Full Docker support
- **OpenVSCode Server**: Web-based VS Code
- **Node.js 22.x & Bun**: JavaScript runtimes
- **Dev Tools**: git, make, gcc, python3
- **CLI Tools**: @devcontainers/cli and others
- **Worker Service**: Socket.IO-based worker

### Using Custom Snapshots

You can override the base snapshot:

1. **Environment Variable**: Set `MORPH_BASE_SNAPSHOT_ID` in `.env`
2. **Command Line**: Pass as 4th argument to quick-debug
3. **Default**: Uses `snapshot_7o3z2iez` (full featured snapshot)

## Common Use Cases

### 1. Test a New Repository

```bash
bun run ./scripts/quick-debug.ts https://github.com/vercel/next.js canary
```

### 2. Debug Devcontainer Issues

Use the interactive tool to execute commands:

```bash
pnpm debug:instance
# Choose option 2 to execute commands
# Try: cat /root/workspace/.devcontainer/devcontainer.json
# Try: docker ps
# Try: npm install
```

### 3. Long-Running Debug Session

```bash
# Start instance
bun run ./scripts/quick-debug.ts

# Note the instance ID
# Do your debugging in VSCode
# Later, stop it:
bun run ./scripts/cleanup-instance.ts morphvm_xxxxx
```

### 4. Test Different Base Snapshots

```bash
# Create a minimal snapshot
pnpm test:snapshot

# Use it for debugging
bun run ./scripts/quick-debug.ts https://github.com/user/repo main snapshot_minimal123
```

## Troubleshooting

### "Base snapshot ID not set" Error

- Ensure `.env` file exists with `MORPH_BASE_SNAPSHOT_ID`
- Or use the default by not setting any env var
- Or pass snapshot ID as CLI argument

### Permission Errors in Devcontainer

The scripts handle permission issues automatically by:
- Setting proper ownership (`chown -R root:root`)
- Using `--skip-post-create` flag
- Falling back to simple dependency install

### Instance Won't Stop

Use the cleanup script:
```bash
bun run ./scripts/cleanup-instance.ts <instance-id>
```

Or use the Morph dashboard to manually stop instances.