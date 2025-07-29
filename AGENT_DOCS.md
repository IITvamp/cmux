# Agent Documentation System

This project uses a generalizable system for managing documentation for different coding agents (Claude, Gemini, OpenAI, etc.).

## How it works

The system automatically creates and maintains documentation files for each agent:
- CLAUDE.md
- GEMINI.md
- OPENAI.md
- AGENTS.md
- CODEX.md
- AMP.md
- OPENCODE.md

## Generalizable Logic

The system implements the following logic:
1. If any agent documentation file exists, it will be used as a template
2. The template is copied to create any missing agent documentation files
3. This ensures all agents have consistent documentation

## Files

- `AGENT_DOCS.md` - This documentation file
- `scripts/copy-agent-docs.cjs` - Script that implements the generalizable logic
- `CLAUDE.md`, `GEMINI.md`, `OPENAI.md`, etc. - Individual agent documentation files

## Usage

To update all agent documentation files based on an existing template:

```bash
node scripts/copy-agent-docs.cjs
```

The script will automatically find any existing agent file and use it as a template to create missing files.