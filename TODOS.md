[x] instead of using node-pty, install openvscode directly and make an extension that lets us interact with vscode's terminal and everything via socketio. like the extension needs to expose a socketio server that we can connect to and then we can send commands to the terminal and get the output back.
[ ] get rid of node-pty entirely -- do a grep/rg of it in entire codebase, then remove it from everywhere. for most places like where we resize the node-pty thing, we can just get rid of it. get rid of the stuff in frontend like $taskId.run.$runId page as well like get rid of TerminalView.tsx and TerminalContextProvider.tsx entirely; when creating a new task inside the worker (like the tmux task specifically), we can just use childproc/exec instead of node-pty.
[ ] copy ~/.claude/CLAUDE.md to relevant places
[ ] copy CLAUDE.md to AGENTS.md, GEMINI.md etc for openai, gemini, etc.
[ ] figure out intricacies of deploying the Dockerfile to daytona
[x] create morph snapshot
[ ] make it easy to provide context to claude code by using cmd + p to open a ton of editors
[x] copy over the credentials properly
[ ] make it easy to create a new task from scratch without any existing directory or git repo
[ ] fallback if user doesn't use gh cli
[ ] authentication
[ ] whenever i start typing in /dashboard, even if i'm not focused on the textinput, it should automatically start typing in the textinput (including the keys i just pressed but weren't focused on the textinput)
[ ] figure out how to get git working, rn worktrees are broken
[ ] make MorphVSCodeInstance actually work
[ ] vercel previews
[ ] vercel comments but it actually just pipes it to claude code and it auto makes a PR!
[ ] auto set up devcontainers: `bun x @devcontainers/cli up --workspace-folder /root/workspace`
[ ] make persistent [worktree/branchname]-vscode.cmux.local domains for each vscode container instance. the cmux.local domains also need to support mapping to the ports in each of the DockerVSCodeInstances. like [worktree/branchname]-[portnumber].cmux.local should map to the port number of the vscode instance.
[ ] rename branches after a task is created to something reasonable
[ ] plan mode for claude code
[ ] update state for agent when they finish a task or fail a task
[ ] run bunx `bunx @devcontainers/cli up --workspace-folder .` and iterate on the .devcontainer/dockerfile/startup script until it works
[x] in @apps/server/src/index.ts, we need to make a new file that contains an express app, and then put it into the createServer call. (make sure to pnpm install express in the right places) the express app's job is to be a proxy to every single DockerVSCodeInstance that ever gets spun up. The goal is if the user goes to [containerName].[port].localhost:3001/ (3001 is the server's port), it should proxy to the port number of the vscode instance. the vscode instance can run other things besides vscode on different ports, but we just colloquially call it "vscode" for now. to do this, we need to modify @apps/server/src/vscode/DockerVSCodeInstance.ts that stores the port mappings of every single vscode instance that ever gets spun up, so that it also stores the container name of the vscode instance. then, in @apps/server/src/index.ts, we can use the express app to proxy to the vscode instance. if a vscode instance is not running, we will need to start it up on the fly. while it's being spun up, we need to show the user a loading screen. once it's ready, we need to redirect the user to the vscode instance. make sure to handle when docker containers get killed and when that happens, we need to update the port mappings. port mappings should be stored in a map in @apps/server/src/vscode/DockerVSCodeInstance.ts.
[ ] figure out how to use convex binary
[ ] package vite app and expose on the express app
[ ] add qwen code https://x.com/oran_ge/status/1947822347517628625
[ ] add grok code
[ ] add atlassian rovo
[ ] make cli good
[ ] cmux cli npm publish and uvx publish
[ ] deno compile
[ ] ensure all the different CLIs work, not just claude
